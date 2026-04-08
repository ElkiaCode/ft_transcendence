import { Injectable, NotFoundException } from '@nestjs/common';
import { UpdateProfileDto } from './dto/dto';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { PrismaService } from './prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });
    if (!user) throw new NotFoundException(`User #${id} not found`);
    return user;
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    const user = await this.findOne(userId);
    if (!user.profile) throw new NotFoundException('Profile not found');

    const updated = await this.prisma.profile.update({
      where: { userId },
      data: {
        displayName: dto.displayName ?? user.profile.displayName,
        bio: dto.bio ?? user.profile.bio,
      },
    });

    return this.toProfileDto(updated);
  }

  async updateAvatar(
    userId: string,
    file: any,
  ): Promise<ProfileResponseDto> {
    const user = await this.findOne(userId);
    if (!user.profile) throw new NotFoundException('Profile not found');

    const uploadDir = '/tmp/avatars';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const avatarKey = `${userId}-${Date.now()}-${file.originalname}`;
    const filePath = path.join(uploadDir, avatarKey);
    fs.writeFileSync(filePath, file.buffer);

    const updated = await this.prisma.profile.update({
      where: { userId },
      data: {
        avatarKey,
        avatarUrl: `/tmp/avatars/${avatarKey}`,
      },
    });

    return this.toProfileDto(updated);
  }

  private toProfileDto(profile: {
    id: string;
    displayName: string;
    bio?: string | null;
    avatarUrl?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): ProfileResponseDto {
    return {
      id: profile.id,
      displayName: profile.displayName,
      bio: profile.bio ?? null,
      avatarUrl: profile.avatarUrl ?? null,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }
}
