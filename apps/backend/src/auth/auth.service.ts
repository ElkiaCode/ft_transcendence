import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { DEFAULT_REFRESH_DAYS } from './constants/auth.constants';
import type { JwtPayload } from './types/jwt-payload.type';
import {
  generateRefreshToken,
  hashRefreshToken,
} from './utils/refresh-token.util';

interface FortyTwoTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  created_at: number;
}

interface FortyTwoOAuthError {
  error?: string;
  error_description?: string;
}

interface FortyTwoUserResponse {
  id: number;
  email: string;
  login: string;
  displayname: string;
  image?: {
    link: string | null;
  };
}

interface UserForPublic {
  id: string;
  email: string;
  username: string;
  globalRole: string;
  preferredLanguage: string;
  passwordHash?: string | null;
  oauthAccounts?: Array<{ provider: string }>;
  profile?: {
    displayName: string;
    bio?: string | null;
    avatarUrl?: string | null;
  } | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  getRefreshTokenDays(): number {
    const raw = this.configService.get<string>('JWT_REFRESH_DAYS');
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : DEFAULT_REFRESH_DAYS;
  }

  getRefreshTokenMaxAgeMs(): number {
    return this.getRefreshTokenDays() * 24 * 60 * 60 * 1000;
  }

  private getRefreshTokenExpiresAt(): Date {
    return new Date(Date.now() + this.getRefreshTokenMaxAgeMs());
  }

  async register(dto: RegisterDto) {
    const email = (dto.email ?? '').trim().toLowerCase();
    const username = dto.username.trim();

    const existingUserByEmail = await this.prisma.client.user.findUnique({
      where: { email },
    });

    if (existingUserByEmail) {
      throw new BadRequestException('email already in use');
    }

    const existingUserByUsername = await this.prisma.client.user.findUnique({
      where: { username },
    });

    if (existingUserByUsername) {
      throw new BadRequestException('username already in use');
    }

    const passwordSalt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(dto.password, passwordSalt);

    const user = await this.prisma.client.user.create({
      data: {
        email,
        username,
        passwordHash,
        profile: {
          create: {
            displayName: username,
          },
        },
      },
      include: {
        profile: true,
      },
    });

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.globalRole,
    };

    const session = await this.createSession(user.id, payload);

    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: this.toPublicUser(user),
    };
  }

  async login(dto: LoginDto) {
    const { password, email: rawEmail } = dto;
    const email = (rawEmail ?? '').trim().toLowerCase();

    const user = await this.prisma.client.user.findUnique({
      where: { email },
      include: {
        profile: true,
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('invalid credentials');
    }

    if (!password) {
      throw new BadRequestException('Password is required');
    }
    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordOk) {
      throw new UnauthorizedException('invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('account is inactive');
    }

    if (user.isBanned) {
      throw new UnauthorizedException('account is banned');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.globalRole,
    };

    const session = await this.createSession(user.id, payload);

    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: this.toPublicUser(user),
    };
  }

  async refresh(rawRefreshToken: string | null) {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('missing refresh token');
    }

    const tokenHash = hashRefreshToken(rawRefreshToken);

    const storedToken = await this.prisma.client.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            profile: true,
            oauthAccounts: {
              select: {
                provider: true,
              },
            },
          },
        },
      },
    });

    if (!storedToken) {
      throw new UnauthorizedException('invalid refresh token');
    }

    if (storedToken.revokedAt) {
      throw new UnauthorizedException('refresh token revoked');
    }

    if (storedToken.expiresAt <= new Date()) {
      throw new UnauthorizedException('refresh token expired');
    }

    if (!storedToken.user.isActive) {
      throw new UnauthorizedException('account is inactive');
    }

    if (storedToken.user.isBanned) {
      throw new UnauthorizedException('account is banned');
    }

    const payload: JwtPayload = {
      sub: storedToken.user.id,
      email: storedToken.user.email,
      username: storedToken.user.username,
      role: storedToken.user.globalRole,
    };

    const newRefreshToken = generateRefreshToken();
    const newRefreshTokenHash = hashRefreshToken(newRefreshToken);
    const newExpiresAt = this.getRefreshTokenExpiresAt();
    const accessToken = await this.signAccessToken(payload);

    await this.prisma.client.$transaction([
      this.prisma.client.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.client.refreshToken.create({
        data: {
          userId: storedToken.userId,
          tokenHash: newRefreshTokenHash,
          expiresAt: newExpiresAt,
        },
      }),
    ]);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: this.toPublicUser(storedToken.user),
    };
  }

  async logout(rawRefreshToken: string | null) {
    if (!rawRefreshToken) {
      return;
    }

    const tokenHash = hashRefreshToken(rawRefreshToken);

    await this.prisma.client.refreshToken.updateMany({
      where: {
        tokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  getFortyTwoAuthorizationUrl(state: string): string {
    const url = new URL('https://api.intra.42.fr/oauth/authorize');
    url.search = new URLSearchParams({
      client_id: this.configService.getOrThrow('FORTYTWO_CLIENT_ID'),
      redirect_uri: this.configService.getOrThrow('FORTYTWO_CALLBACK_URL'),
      response_type: 'code',
      scope: 'public',
      state,
    }).toString();
    return url.toString();
  }

  async loginWith42(code: string) {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.configService.getOrThrow('FORTYTWO_CLIENT_ID'),
      client_secret: this.configService.getOrThrow('FORTYTWO_CLIENT_SECRET'),
      code,
      redirect_uri: this.configService.getOrThrow('FORTYTWO_CALLBACK_URL'),
    });

    let tokenResponse: Response;

    try {
      tokenResponse = await fetch('https://api.intra.42.fr/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'unknown network error';
      this.logger.error(`Could not reach the 42 token endpoint: ${message}`);
      throw new BadGatewayException('42 API is unreachable');
    }

    if (!tokenResponse.ok) {
      const reason = await this.readFortyTwoError(tokenResponse);
      this.logger.warn(
        `42 token exchange failed (${tokenResponse.status}): ${reason}`,
      );
      throw new UnauthorizedException(`42 OAuth failed: ${reason}`);
    }

    const tokenData = (await tokenResponse.json()) as FortyTwoTokenResponse;
    const accessToken42 = tokenData.access_token;
    let userResponse: Response;

    try {
      userResponse = await fetch('https://api.intra.42.fr/v2/me', {
        headers: { Authorization: `Bearer ${accessToken42}` },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'unknown network error';
      this.logger.error(`Could not reach the 42 user endpoint: ${message}`);
      throw new BadGatewayException('42 API is unreachable');
    }

    if (!userResponse.ok) {
      const reason = await this.readFortyTwoError(userResponse);
      this.logger.warn(
        `42 user request failed (${userResponse.status}): ${reason}`,
      );
      throw new UnauthorizedException(`42 user request failed: ${reason}`);
    }

    const user42 = (await userResponse.json()) as FortyTwoUserResponse;
    const email = user42.email.trim().toLowerCase();
    const providerAccountId = String(user42.id);
    let user = await this.prisma.client.user.findFirst({
      where: {
        oauthAccounts: {
          some: {
            provider: '42',
            providerAccountId,
          },
        },
      },
      include: { profile: true },
    });

    if (!user) {
      const existingUser = await this.prisma.client.user.findUnique({
        where: { email },
        include: { profile: true },
      });

      if (existingUser) {
        await this.prisma.client.oAuthAccount.create({
          data: {
            userId: existingUser.id,
            provider: '42',
            providerAccountId,
          },
        });
        user = existingUser;
      } else {
        const username = await this.getAvailableFortyTwoUsername(
          user42.login,
          providerAccountId,
        );

        user = await this.prisma.client.user.create({
          data: {
            email,
            username,
            profile: {
              create: {
                displayName: user42.displayname ?? user42.login,
                avatarUrl: user42.image?.link ?? null,
              },
            },
            oauthAccounts: {
              create: {
                provider: '42',
                providerAccountId,
              },
            },
          },
          include: { profile: true },
        });
      }
    }

    if (!user.isActive) throw new UnauthorizedException('account is inactive');
    if (user.isBanned) throw new UnauthorizedException('account is banned');

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.globalRole,
    };

    const session = await this.createSession(user.id, payload);
    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: this.toPublicUser(user),
    };
  }

  private async readFortyTwoError(response: Response): Promise<string> {
    try {
      const payload = (await response.json()) as FortyTwoOAuthError;
      return (
        payload.error_description ?? payload.error ?? `HTTP ${response.status}`
      );
    } catch {
      return `HTTP ${response.status}`;
    }
  }

  private async getAvailableFortyTwoUsername(
    requestedUsername: string,
    providerAccountId: string,
  ): Promise<string> {
    const baseUsername =
      requestedUsername.trim().replace(/[^a-zA-Z0-9_]/g, '_') ||
      `user_${providerAccountId}`;
    const preferredUsername = baseUsername.slice(0, 30);
    const preferredUser = await this.prisma.client.user.findUnique({
      where: { username: preferredUsername },
      select: { id: true },
    });

    if (!preferredUser) {
      return preferredUsername;
    }

    const suffix = `_${providerAccountId}`;
    return `${baseUsername.slice(0, Math.max(1, 30 - suffix.length))}${suffix}`;
  }

  async signAccessToken(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(payload);
  }

  private async createSession(userId: string, payload: JwtPayload) {
    const accessToken = await this.signAccessToken(payload);
    const refreshToken = generateRefreshToken();
    const tokenHash = hashRefreshToken(refreshToken);
    const expiresAt = this.getRefreshTokenExpiresAt();

    await this.prisma.client.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private toPublicUser(user: UserForPublic) {
    const authProviders: string[] = [];

    if (user.passwordHash) {
      authProviders.push('LOCAL');
    }

    if (user.oauthAccounts && Array.isArray(user.oauthAccounts)) {
      user.oauthAccounts.forEach((acc) => {
        authProviders.push(acc.provider);
      });
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      globalRole: user.globalRole,
      preferredLanguage: user.preferredLanguage,
      // Use Set to remove duplicates (e.g. if logic changes later)
      authProviders: Array.from(new Set(authProviders)),
      profile: user.profile
        ? {
            displayName: user.profile.displayName,
            bio: user.profile.bio ?? null,
            avatarUrl: user.profile.avatarUrl ?? null,
          }
        : null,
    };
  }
}
