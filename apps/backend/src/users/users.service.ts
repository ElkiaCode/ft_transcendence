import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EraseMyDataDto } from 'src/auth/dto/erase-my-data.dto';
import * as bcrypt from 'bcrypt';
import { UpdateProfileDto } from './dto/dto';
import { ProfileResponseDto } from './dto/profile-response.dto';
import * as fs from 'fs';
//import * as path from 'path';

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

    async searchUsers(currentUserId: string, rawQuery: string) {
      const q = rawQuery?.trim() ?? '';

      if (q.length < 2) {
        return [];
      }

      const users = await this.prisma.user.findMany({
        where: {
          id: { not: currentUserId },
          isActive: true,
          isBanned: false,
          OR: [
            {
              username: {
                contains: q,
                mode: 'insensitive',
              },
            },
            {
              profile: {
                is: {
                  displayName: {
                    contains: q,
                    mode: 'insensitive',
                  },
                },
              },
            },
          ],
          NOT: [
            {
              blocksInitiated: {
                some: {
                  blockedId: currentUserId,
                },
              },
            },
            {
              blocksReceived: {
                some: {
                  blockerId: currentUserId,
                },
              },
            },
          ],
        },
        include: {
          profile: true,
        },
        orderBy: [
          { username: 'asc' },
        ],
        take: 20,
      });

      return users.map((user) => ({
        id: user.id,
        username: user.username,
        profile: user.profile
          ? {
              displayName: user.profile.displayName,
              avatarUrl: user.profile.avatarUrl,
            }
          : null,
      }));
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
        //const filePath = path.join(uploadDir, avatarKey);
        //fs.writeFileSync(filePath, file.buffer);

        const updated = await this.prisma.profile.update({
        where: { userId },
        data: {
        //avatarKey,
        //avatarUrl: `/tmp/avatars/${avatarKey}`,
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

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('user not found');
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      globalRole: user.globalRole,
      preferredLanguage: user.preferredLanguage,
      isActive: user.isActive,
      isBanned: user.isBanned,
      profile: user.profile
        ? {
            displayName: user.profile.displayName,
            bio: user.profile.bio,
            avatarUrl: user.profile.avatarUrl,
          }
        : null,
    };
  }

  async eraseMyData(userId: string, dto: EraseMyDataDto) {
    const user = await this.prisma.user.findUnique({
      where: { id : userId},
      include: {
        profile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('user not found');
    }

    if (user.passwordHash) {
      if (!dto.currentPassword) {
        throw new BadRequestException('current password is required');
      }

      const passwordOk = await bcrypt.compare(dto.currentPassword, user.passwordHash);

      if (!passwordOk) {
        throw new BadRequestException('invalid credentials');
      }

      await this.prisma.user.delete({
        where: { id: userId}
      });

      return {success: true, message: 'Your account have been erased'};
    }
  }
}

