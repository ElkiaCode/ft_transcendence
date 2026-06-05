import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EraseMyDataDto } from '../auth/dto/erase-my-data.dto';
import * as bcrypt from 'bcrypt';
import { UpdateProfileDto } from './dto/dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { ChatGateway } from '../chat/chat.gateway';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly chatGateway: ChatGateway,
  ) {}

  private async notifyUser(
    userId: string,
    input: Parameters<NotificationsService['createFromInput']>[1],
  ) {
    const notification = await this.notificationsService.createFromInput(
      userId,
      input,
    );
    await this.chatGateway.emitNotificationCreated(userId, notification);
    return notification;
  }

  private async notifyAdminsAndModerators(
    input: Parameters<NotificationsService['createFromInput']>[1],
    excludeUserId?: string,
  ) {
    const recipients = await this.prisma.user.findMany({
      where: {
        globalRole: { in: ['ADMIN', 'MODERATOR'] },
        isActive: true,
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      },
      select: { id: true },
    });

    const notifications =
      await this.notificationsService.createFromInputForMany(
        recipients.map((recipient) => recipient.id),
        input,
      );

    for (const notification of notifications) {
      await this.chatGateway.emitNotificationCreated(
        notification.userId,
        notification,
      );
    }

    return notifications;
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
      orderBy: [{ username: 'asc' }],
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

  async getTopPositivePointUsers() {
    const users = await this.prisma.user.findMany({
      where: {
        penaltyPoints: { gt: 0 },
        isActive: true,
        isBanned: false,
      },
      select: {
        id: true,
        username: true,
        globalRole: true,
        penaltyPoints: true,
        profile: {
          select: {
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [{ penaltyPoints: 'desc' }, { username: 'asc' }],
      take: 10,
    });

    return users.map((user) => ({
      id: user.id,
      username: user.username,
      globalRole: user.globalRole,
      penaltyPoints: user.penaltyPoints,
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
        profile: true,
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

    await this.notifyUser(userId, {
      type: 'SYSTEM',
      title: 'Profile updated',
      body: 'Your profile information was updated.',
      actorId: userId,
      entityType: 'user',
      entityId: userId,
      action: 'profile_updated',
      metadata: {
        displayNameChanged: dto.displayName !== undefined,
        bioChanged: dto.bio !== undefined,
      },
    });

    return {
        id: user.id,
        email: user.email,
        username: user.username,
        penaltyPoints: user.penaltyPoints,
        profile: user.profile
        ? {
            displayName: profile.displayName,
            bio: profile.bio,
            avatarUrl: profile.avatarUrl,
          }
        : null,
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
      throw new BadRequestException('User account is inactive');
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('invalid file type');
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('file is too large!');
    }

    const avatarPath = `${process.env.API_URL || 'https://localhost'}/uploads/${file.filename}`;

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

    await this.notifyUser(userId, {
      type: 'SYSTEM',
      title: 'Avatar updated',
      body: 'Your profile avatar was updated.',
      actorId: userId,
      entityType: 'user',
      entityId: userId,
      action: 'profile_avatar_updated',
      metadata: {
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
      penaltyPoints: user.penaltyPoints,
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

  async exportMyData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        globalRole: true,
        isActive: true,
        isBanned: true,
        penaltyPoints: true,
        preferredLanguage: true,
        createdAt: true,
        updatedAt: true,
        profile: true,
        oauthAccounts: {
          select: {
            id: true,
            provider: true,
            providerAccountId: true,
            createdAt: true,
          },
        },
        refreshTokens: {
          select: {
            id: true,
            expiresAt: true,
            revokedAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('user not found');
    }

    const [
      friendships,
      blocksInitiated,
      blocksReceived,
      conversations,
      messagesSent,
      messageReads,
      messageReactions,
      notifications,
      reportsCreated,
      reportsReceived,
      moderationReceived,
      moderationActionsPerformed,
    ] = await Promise.all([
      this.prisma.friendship.findMany({
        where: {
          OR: [{ requesterId: userId }, { addresseeId: userId }],
        },
        include: {
          requester: {
            select: {
              id: true,
              username: true,
              profile: {
                select: {
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
          },
          addressee: {
            select: {
              id: true,
              username: true,
              profile: {
                select: {
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.block.findMany({
        where: { blockerId: userId },
        include: {
          blocked: {
            select: {
              id: true,
              username: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.block.findMany({
        where: { blockedId: userId },
        include: {
          blocker: {
            select: {
              id: true,
              username: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.conversationParticipant.findMany({
        where: { userId },
        include: {
          conversation: {
            include: {
              participants: {
                include: {
                  user: {
                    select: {
                      id: true,
                      username: true,
                    },
                  },
                },
                orderBy: { joinedAt: 'asc' },
              },
              messages: {
                where: {
                  OR: [
                    { senderId: userId },
                    { reads: { some: { userId } } },
                    { reactions: { some: { userId } } },
                  ],
                },
                select: {
                  id: true,
                  senderId: true,
                  content: true,
                  type: true,
                  isEdited: true,
                  deletedAt: true,
                  createdAt: true,
                  updatedAt: true,
                },
                orderBy: { createdAt: 'asc' },
              },
            },
          },
        },
        orderBy: { joinedAt: 'desc' },
      }),
      this.prisma.message.findMany({
        where: { senderId: userId },
        select: {
          id: true,
          conversationId: true,
          content: true,
          type: true,
          isEdited: true,
          deletedAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.messageRead.findMany({
        where: { userId },
        select: {
          id: true,
          messageId: true,
          readAt: true,
        },
        orderBy: { readAt: 'desc' },
      }),
      this.prisma.messageReaction.findMany({
        where: { userId },
        select: {
          id: true,
          messageId: true,
          type: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.report.findMany({
        where: { creatorId: userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.report.findMany({
        where: { targetUserId: userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.moderationAction.findMany({
        where: { targetUserId: userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.moderationAction.findMany({
        where: { moderatorId: userId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      format: 'transcendence-user-data-export-v1',
      account: user,
      relationships: {
        friendships: friendships.map((friendship) => {
          const otherUser =
            friendship.requesterId === userId
              ? friendship.addressee
              : friendship.requester;

          return {
            id: friendship.id,
            status: friendship.status,
            createdAt: friendship.createdAt,
            updatedAt: friendship.updatedAt,
            direction: friendship.requesterId === userId ? 'sent' : 'received',
            otherUser,
          };
        }),
        blocksInitiated,
        blocksReceived,
      },
      chat: {
        conversations,
        messagesSent,
        messageReads,
        messageReactions,
      },
      notifications,
      moderation: {
        reportsCreated,
        reportsReceived,
        moderationReceived,
        moderationActionsPerformed,
      },
    };
  }

  async eraseMyData(userId: string, dto: EraseMyDataDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
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

      const passwordOk = await bcrypt.compare(
        dto.currentPassword,
        user.passwordHash,
      );

      if (!passwordOk) {
        throw new BadRequestException('invalid credentials');
      }
    }

    await this.notifyAdminsAndModerators(
      {
        type: 'SYSTEM',
        title: 'Account deleted',
        body: `${user.username} deleted their account.`,
        actorId: userId,
        entityType: 'user',
        entityId: userId,
        action: 'account_deleted',
        metadata: {
          deletedUserId: userId,
          username: user.username,
          email: user.email,
        },
      },
      userId,
    );

    await this.prisma.user.delete({
      where: { id: userId },
    });

    return { success: true, message: 'Your account have been erased' };
  }

  async getMyFriends(userId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
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
      const friend =
        friendship.requesterId === userId
          ? friendship.addressee
          : friendship.requester;

      return {
        id: friend.id,
        username: friend.username,
        displayName: friend.profile?.displayName ?? friend.username,
        avatarUrl: friend.profile?.avatarUrl ?? null,
      };
    });
  }

  async updatePassword(userId: string, dto: UpdatePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new NotFoundException('User not found');
    if (!user.passwordHash)
      throw new BadRequestException(
        'Cannot change password for OAuth accounts',
      );

    const passwordOk = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!passwordOk) throw new BadRequestException('Invalid current password');

    const newHash = await bcrypt.hash(dto.newPassword, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    await this.notifyUser(userId, {
      type: 'SYSTEM',
      title: 'Password changed',
      body: 'Your password was changed.',
      actorId: userId,
      entityType: 'user',
      entityId: userId,
      action: 'password_updated',
      metadata: {
        changedAt: new Date().toISOString(),
      },
    });

    return { success: true, message: 'Password updated successfully' };
  }

  async getUserByUsername(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: { profile: true },
    });

    if (!user) throw new NotFoundException('User not found');

    return {
      id: user.id,
      username: user.username,
      globalRole: user.globalRole,      // ajouté
      isBanned: user.isBanned,          // ajouté
      isActive: user.isActive,          // ajouté
      penaltyPoints: user.penaltyPoints, // ajouté
      profile: user.profile ? {
        displayName: user.profile.displayName,
        bio: user.profile.bio,
        avatarUrl: user.profile.avatarUrl,
      } : null,
    };
  }

  async getMyPoints(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('User not found');
    return { penaltyPoints: user.penaltyPoints };
  }
}
