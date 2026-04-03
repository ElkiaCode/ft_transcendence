import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
}