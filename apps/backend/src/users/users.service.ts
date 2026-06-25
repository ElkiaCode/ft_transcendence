import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EraseMyDataDto } from '../auth/dto/erase-my-data.dto';
import * as bcrypt from 'bcrypt';
import { UpdateProfileDto } from './dto/dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { ChatGateway } from '../chat/chat.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { MailService } from '../mail/mail.service';
import {
  generateDataErasureToken,
  hashDataErasureToken,
} from './utils/data-erasure-token.util';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly chatGateway: ChatGateway,
    private readonly mailService: MailService,
  ) {}

  private async notifyUser(
    userId: string,
    input: Parameters<NotificationsService['createFromInput']>[1],
  ) {
    const notification = await this.notificationsService.createFromInput(
      userId,
      input,
    );
    this.chatGateway.emitNotificationCreated(userId, notification);
    return notification;
  }

  private async notifyAdminsAndModerators(
    input: Parameters<NotificationsService['createFromInput']>[1],
    excludeUserId?: string,
  ) {
    const recipients = await this.prisma.client.user.findMany({
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
      this.chatGateway.emitNotificationCreated(
        notification.userId,
        notification,
      );
    }

    return notifications;
  }

  private getLocalAvatarPath(avatarUrl: string | null | undefined) {
    if (!avatarUrl) {
      return null;
    }

    let pathname: string;

    try {
      const localBaseUrl = new URL(
        process.env.API_URL || 'https://localhost:8443',
      );
      const parsedAvatarUrl = new URL(avatarUrl, localBaseUrl);

      if (parsedAvatarUrl.origin !== localBaseUrl.origin) {
        return null;
      }

      pathname = parsedAvatarUrl.pathname;
    } catch {
      return null;
    }

    const uploadsPrefix = '/uploads/';

    if (!pathname.startsWith(uploadsPrefix)) {
      return null;
    }

    let filename: string;

    try {
      filename = decodeURIComponent(pathname.slice(uploadsPrefix.length));
    } catch {
      return null;
    }

    if (!filename || filename.includes('/') || filename.includes('\\')) {
      return null;
    }

    return resolve(process.cwd(), 'uploads', filename);
  }

  private async deleteLocalAvatar(avatarUrl: string | null | undefined) {
    const avatarPath = this.getLocalAvatarPath(avatarUrl);

    if (!avatarPath) {
      return;
    }

    try {
      await unlink(avatarPath);
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return;
      }

      throw error;
    }
  }

  async searchUsers(currentUserId: string, rawQuery: string) {
    const q = rawQuery?.trim() ?? '';

    if (q.length < 2) {
      return [];
    }

    const users = await this.prisma.client.user.findMany({
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
      },
      include: {
        profile: true,
        blocksReceived: {
          where: { blockerId: currentUserId },
          select: { id: true },
        },
        blocksInitiated: {
          where: { blockedId: currentUserId },
          select: { id: true },
        },
      },
      orderBy: [{ username: 'asc' }],
      take: 20,
    });

    return users.map((user) => ({
      id: user.id,
      username: user.username,
      isBlockedByCurrentUser: user.blocksReceived.length > 0,
      hasBlockedCurrentUser: user.blocksInitiated.length > 0,
      profile: user.profile
        ? {
            displayName: user.profile.displayName,
            avatarUrl: user.profile.avatarUrl,
          }
        : null,
    }));
  }

  async searchUsersAdmin(rawQuery: string) {
  const q = rawQuery?.trim() ?? '';

  if (q.length < 2) {
    return [];
  }

  const users = await this.prisma.client.user.findMany({
    where: {
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
    isBanned: user.isBanned,
    isActive: user.isActive,
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

  async getTopPositivePointUsers() {
    const users = await this.prisma.client.user.findMany({
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
    const user = await this.prisma.client.user.findUnique({
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

    const profile = await this.prisma.client.profile.upsert({
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
    const user = await this.prisma.client.user.findUnique({
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

    const avatarPath = `${process.env.API_URL || 'https://localhost:8443'}/uploads/${file.filename}`;

    const profile = await this.prisma.client.profile.upsert({
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

    if (
      user.profile?.avatarUrl &&
      user.profile.avatarUrl !== profile.avatarUrl
    ) {
      try {
        await this.deleteLocalAvatar(user.profile.avatarUrl);
      } catch (error) {
        this.logger.warn(
          `Could not delete previous avatar for user ${userId}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

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
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        oauthAccounts: {
          select: {
            provider: true,
          },
        },
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
      authProviders: [
        ...(user.passwordHash ? ['LOCAL'] : []),
        ...user.oauthAccounts.map((account) => account.provider),
      ],
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
    const user = await this.prisma.client.user.findUnique({
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
      this.prisma.client.friendship.findMany({
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
      this.prisma.client.block.findMany({
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
      this.prisma.client.block.findMany({
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
      this.prisma.client.conversationParticipant.findMany({
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
      this.prisma.client.message.findMany({
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
      this.prisma.client.messageRead.findMany({
        where: { userId },
        select: {
          id: true,
          messageId: true,
          readAt: true,
        },
        orderBy: { readAt: 'desc' },
      }),
      this.prisma.client.messageReaction.findMany({
        where: { userId },
        select: {
          id: true,
          messageId: true,
          type: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.report.findMany({
        where: { creatorId: userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.report.findMany({
        where: { targetUserId: userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.moderationAction.findMany({
        where: { targetUserId: userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.moderationAction.findMany({
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

  async requestDataErasure(userId: string, dto: EraseMyDataDto) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        passwordHash: true,
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

    const rawToken = generateDataErasureToken();
    const tokenHash = hashDataErasureToken(rawToken);
    const expiresAt = new Date(
      Date.now() + this.getDataErasureTokenLifetimeMinutes() * 60 * 1000,
    );

    await this.prisma.client.dataErasureRequest.upsert({
      where: { userId },
      update: {
        tokenHash,
        expiresAt,
      },
      create: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    try {
      await this.mailService.sendDataErasureConfirmation(user.email, rawToken);
    } catch (error) {
      await this.prisma.client.dataErasureRequest.deleteMany({
        where: {
          userId,
          tokenHash,
        },
      });
      throw error;
    }

    return {
      success: true,
      message: 'A confirmation email has been sent.',
      expiresAt,
    };
  }

  async confirmDataErasure(
    authenticatedUserId: string,
    rawToken: string,
    currentPassword?: string,
  ) {
    const tokenHash = hashDataErasureToken(rawToken.trim());
    const request = await this.prisma.client.dataErasureRequest.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!request || request.expiresAt <= new Date()) {
      if (request) {
        await this.prisma.client.dataErasureRequest.deleteMany({
          where: { id: request.id },
        });
      }

      throw new BadRequestException('invalid or expired deletion confirmation');
    }

    const { user } = request;

    if (request.userId !== authenticatedUserId) {
      throw new ForbiddenException(
        'deletion confirmation does not belong to authenticated user',
      );
    }

    if (user.passwordHash) {
      if (!currentPassword) {
        throw new BadRequestException('current password is required');
      }

      const passwordOk = await bcrypt.compare(
        currentPassword,
        user.passwordHash,
      );

      if (!passwordOk) {
        throw new BadRequestException('invalid credentials');
      }
    }

    await this.deleteLocalAvatar(user.profile?.avatarUrl);

    await this.prisma.client.$transaction(async (tx) => {
      const claimedRequest = await tx.dataErasureRequest.deleteMany({
        where: {
          id: request.id,
          userId: authenticatedUserId,
          tokenHash,
          expiresAt: { gt: new Date() },
        },
      });

      if (claimedRequest.count !== 1) {
        throw new BadRequestException(
          'invalid or expired deletion confirmation',
        );
      }

      await tx.notification.deleteMany({
        where: {
          OR: [{ actorId: user.id }, { entityId: user.id }],
        },
      });
      await tx.report.deleteMany({
        where: { creatorId: user.id },
      });
      await tx.moderationAction.deleteMany({
        where: { targetUserId: user.id },
      });
      await tx.conversation.updateMany({
        where: {
          participants: {
            some: { userId: user.id },
          },
        },
        data: {
          participantHash: null,
        },
      });
      await tx.user.delete({
        where: { id: user.id },
      });
    });

    try {
      await this.notifyAdminsAndModerators({
        type: 'SYSTEM',
        title: 'Account deleted',
        body: 'A user deleted their account.',
        entityType: 'system',
        entityId: 'account-deletion',
        action: 'account_deleted',
      });
    } catch (error) {
      this.logger.warn(
        'Could not notify moderators about an account deletion',
        error instanceof Error ? error.message : undefined,
      );
    }

    let confirmationEmailSent = true;

    try {
      await this.mailService.sendDataErasureCompleted(user.email);
    } catch (error) {
      confirmationEmailSent = false;
      this.logger.warn(
        'Could not send the data erasure completion email',
        error instanceof Error ? error.message : undefined,
      );
    }

    return {
      success: true,
      message: 'Your account and personal data have been erased.',
      confirmationEmailSent,
    };
  }

  private getDataErasureTokenLifetimeMinutes() {
    const configuredLifetime = Number(
      process.env.DATA_ERASURE_TOKEN_TTL_MINUTES ?? 30,
    );

    return Number.isFinite(configuredLifetime) && configuredLifetime > 0
      ? configuredLifetime
      : 30;
  }

  async getMyFriends(userId: string) {
    const friendships = await this.prisma.client.friendship.findMany({
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
    const user = await this.prisma.client.user.findUnique({
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

    const passwordSalt = await bcrypt.genSalt(12);
    const newHash = await bcrypt.hash(dto.newPassword, passwordSalt);

    await this.prisma.client.user.update({
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
    const user = await this.prisma.client.user.findUnique({
      where: { username },
      include: { profile: true },
    });

    if (!user) throw new NotFoundException('User not found');

    return {
      id: user.id,
      username: user.username,
      globalRole: user.globalRole,
      isBanned: user.isBanned,
      isActive: user.isActive,
      penaltyPoints: user.penaltyPoints,
      profile: user.profile
        ? {
            displayName: user.profile.displayName,
            bio: user.profile.bio,
            avatarUrl: user.profile.avatarUrl,
          }
        : null,
    };
  }

  async getMyPoints(userId: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('User not found');
    return { penaltyPoints: user.penaltyPoints };
  }
}
