import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EraseMyDataDto } from 'src/auth/dto/erase-my-data.dto';
import * as bcrypt from 'bcrypt';
import { UpdateProfileDto } from './dto/dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
    
    async updateProfile(userId: string, dto: UpdateProfileDto) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          include: {
            profile: true
          },
        });

        if (!user) {
          throw new NotFoundException('User does not exist');
        }

        if (user.isBanned) {
          throw new BadRequestException('User is banned');
        }

        if (!user.isActive) {
          throw new BadRequestException('User account is inactive');
        }

        const profile = await this.prisma.profile.upsert({
          where: { userId },
          update: {
            ...(dto.displayName !== undefined && { displayName: dto.displayName }),
            ...(dto.bio !== undefined && { bio: dto.bio }),
          },
          create: {
            userId,
            displayName: dto.displayName ?? user.username,
            bio: dto.bio ?? '',
          },
        });

        return {
          id: user.id,
          email: user.email,
          username: user.username,
          profile: user.profile
            ? {
                displayName: profile.displayName,
                bio: profile.bio,
                avatarUrl: profile.avatarUrl,
              }
            : null
        };
    }

    async updateAvatar(userId: string, file: Express.Multer.File) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          profile: true,
        },
      });

      if (!user) {
        throw new NotFoundException('User does not exist');
      }

      if (!file) {
        throw new NotFoundException('No file given');
      }

      if (user.isBanned) {
        throw new BadRequestException('User is banned');
      }

      if (!user.isActive) {
        throw new BadRequestException('User account is inactive')
      }

      const allowedMimeTypes = ['image/jpeg', 'image/png'];
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException('invalid file type');
      }

      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        throw new BadRequestException('file is too large!');
      }

      const avatarPath = `${process.env.API_URL || 'https://localhost:3001'}/uploads/${file.filename}`;

      const profile = await this.prisma.profile.upsert({
        where: { userId },
        update: {
          avatarUrl: avatarPath,
        },
        create: {
          userId,
          displayName: user.username,
          bio: '',
          avatarUrl: avatarPath,
        },
      });

      return {
        message: 'file uploaded successfully',
        avatarPath,
        profile: {
          displayName: profile.displayName,
          bio: profile.bio,
          avatarUrl: profile.avatarUrl,
        },
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

    async getMyFriends(userId: string) {
      const friendships = await this.prisma.friendship.findMany({
        where: {
          status: 'ACCEPTED',
          OR: [
            { requesterId: userId },
            { addresseeId: userId },
          ],
        },
        include: {
          requester: {
            include: { profile: true },
          },
          addressee: {
            include: { profile: true },
          },
        },
      });

      return friendships.map((friendship) => {
        const friend = friendship.requesterId === userId ? friendship.addressee : friendship.requester;

        return {
          id: friend.id,
          username: friend.username,
          displayName: friend.profile?.displayName ?? friend.username,
          avatarUrl: friend.profile?.avatarUrl ?? null,
        };
      });
    }
}

