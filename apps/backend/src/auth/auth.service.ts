import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import type { JwtPayload } from './types/jwt-payload.type';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

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

    const accessToken = await this.signAccessToken({
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.globalRole,
    });

    return {
      accessToken,
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

    const accessToken = await this.signAccessToken({
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.globalRole,
    });

    return {
      accessToken,
      user: this.toPublicUser(user),
    };
  }

  async signAccessToken(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(payload);
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