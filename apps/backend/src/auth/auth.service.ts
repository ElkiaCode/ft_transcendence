import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { DEFAULT_REFRESH_DAYS } from './constants/auth.constants';
import type { JwtPayload } from './types/jwt-payload.type';
import { generateRefreshToken, hashRefreshToken } from './utils/refresh-token.util';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  getRefreshTokenDays(): number {
    const raw = this.configService.get<string>('JWT_REFRESH_DAYS');
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_REFRESH_DAYS;
  }

  getRefreshTokenMaxAgeMs(): number {
    return this.getRefreshTokenDays() * 24 * 60 * 60 * 1000;
  }

  private getRefreshTokenExpiresAt(): Date {
    return new Date(Date.now() + this.getRefreshTokenMaxAgeMs());
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const username = dto.username.trim();

    const existingUserByEmail = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUserByEmail) {
      throw new BadRequestException('email already in use');
    }

    const existingUserByUsername = await this.prisma.user.findUnique({
      where: { username },
    });

    if (existingUserByUsername) {
      throw new BadRequestException('username already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
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
    const email = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        profile: true,
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('invalid credentials');
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

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            profile: true,
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

    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.refreshToken.create({
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

    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async loginWith42(code: string) {
    // 1. Échanger le code contre un token 42
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.configService.getOrThrow('FORTYTWO_CLIENT_ID'),
      client_secret: this.configService.getOrThrow('FORTYTWO_CLIENT_SECRET'),
      code,
      redirect_uri: this.configService.getOrThrow('FORTYTWO_CALLBACK_URL'),
    });

    const tokenResponse = await fetch('https://api.intra.42.fr/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!tokenResponse.ok) {
      throw new UnauthorizedException('invalid 42 code');
    }

    const tokenData = await tokenResponse.json();
    const accessToken42 = tokenData.access_token;

    // 2. Récupérer les infos du user depuis l'API 42
    const userResponse = await fetch('https://api.intra.42.fr/v2/me', {
      headers: { Authorization: `Bearer ${accessToken42}` },
    });

    if (!userResponse.ok) {
      throw new UnauthorizedException('failed to fetch 42 user');
    }

    const user42 = await userResponse.json();

    // 3. Chercher ou créer le user en DB
    let user = await this.prisma.user.findFirst({
      where: {
        oauthAccounts: {
          some: {
            provider: '42',
            providerAccountId: String(user42.id),
          },
        },
      },
      include: { profile: true },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: user42.email,
          username: user42.login,
          profile: {
            create: {
              displayName: user42.displayname ?? user42.login,
              avatarUrl: user42.image?.link ?? null,
            },
          },
          oauthAccounts: {
            create: {
              provider: '42',
              providerAccountId: String(user42.id),
            },
          },
        },
        include: { profile: true },
      });
    }

    if (!user.isActive) throw new UnauthorizedException('account is inactive');
    if (user.isBanned) throw new UnauthorizedException('account is banned');

    // 4. Créer notre propre session JWT
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

  async signAccessToken(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(payload);
  }

  private async createSession(userId: string, payload: JwtPayload) {
    const accessToken = await this.signAccessToken(payload);
    const refreshToken = generateRefreshToken();
    const tokenHash = hashRefreshToken(refreshToken);
    const expiresAt = this.getRefreshTokenExpiresAt();

    await this.prisma.refreshToken.create({
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

  private toPublicUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      globalRole: user.globalRole,
      preferredLanguage: user.preferredLanguage,
      profile: user.profile
        ? {
            displayName: user.profile.displayName,
            bio: user.profile.bio,
            avatarUrl: user.profile.avatarUrl,
          }
        : null,
    };
  }
}
