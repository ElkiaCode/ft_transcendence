import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EraseMyDataDto } from 'src/auth/dto/erase-my-data.dto';
import * as bcrypt from 'bcrypt';

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