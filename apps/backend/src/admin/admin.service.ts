import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatGateway } from '../chat/chat.gateway';
import { Notification } from '@prisma/client';
import {
  NotificationInput,
  NotificationsService,
} from '../notifications/notifications.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly chatGateway: ChatGateway,
  ) {}

  private async notifyUser(
    userId: string,
    input: NotificationInput,
  ): Promise<Notification> {
    const notification = (await this.notificationsService.createFromInput(
      userId,
      input,
    )) as unknown as Notification;
    this.chatGateway.emitNotificationCreated(userId, notification);
    return notification;
  }

  async banUser(targetUserId: string, actorUserId: string) {
    if (targetUserId === actorUserId) {
      throw new BadRequestException('User cannot ban himself...');
    }

    const isTargetUserExist = await this.prisma.client.user.findUnique({
      where: { id: targetUserId },
      include: { profile: true },
    });

    if (!isTargetUserExist) {
      throw new NotFoundException('User to ban does not exist');
    }

    if (isTargetUserExist.isBanned) {
      throw new BadRequestException('User already banned');
    }

    const [updateUser] = await this.prisma.client.$transaction([
      this.prisma.client.user.update({
        where: { id: targetUserId },
        data: { isBanned: true, isActive: false },
        include: { profile: true },
      }),
      this.prisma.client.refreshToken.updateMany({
        where: { userId: targetUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    const notification = await this.notifyUser(targetUserId, {
      type: 'MODERATION',
      title: 'Account banned',
      body: 'Your account was banned by an administrator or moderator.',
      actorId: actorUserId,
      entityType: 'user',
      entityId: targetUserId,
      action: 'admin_user_banned',
      metadata: {
        targetUsername: updateUser.username,
      },
    });

    await this.chatGateway.emitModerationBanAndDisconnect(targetUserId, {
      message: notification.body,
      reason: 'admin action',
    });

    return {
      message: 'user banned',
      user: {
        id: updateUser.id,
        email: updateUser.email,
        username: updateUser.username,
        globalRole: updateUser.globalRole,
        isActive: updateUser.isActive,
        isBanned: updateUser.isBanned,
        profile: updateUser.profile
          ? {
              displayName: updateUser.profile.displayName,
              bio: updateUser.profile.bio,
              avatarUrl: updateUser.profile.avatarUrl,
            }
          : null,
      },
    };
  }

  async unbanUser(targetUserId: string, actorUserId: string) {
    if (targetUserId == actorUserId) {
      throw new BadRequestException('user cannot unban himself...');
    }

    const banUser = await this.prisma.client.user.findUnique({
      where: { id: targetUserId },
      include: { profile: true },
    });

    if (!banUser) {
      throw new NotFoundException('user to unban does not exist');
    }

    if (banUser.isBanned === false) {
      throw new BadRequestException('user is not banned');
    }

    const updateUser = await this.prisma.client.user.update({
      where: { id: targetUserId },
      data: { isBanned: false, isActive: true },
      include: { profile: true },
    });

    await this.notifyUser(targetUserId, {
      type: 'MODERATION',
      title: 'Account unbanned',
      body: 'Your account was unbanned.',
      actorId: actorUserId,
      entityType: 'user',
      entityId: targetUserId,
      action: 'admin_user_unbanned',
      metadata: {
        targetUsername: updateUser.username,
      },
    });

    return {
      message: 'user unbanned',
      user: {
        id: updateUser.id,
        email: updateUser.email,
        username: updateUser.username,
        globalRole: updateUser.globalRole,
        isActive: updateUser.isActive,
        isBanned: updateUser.isBanned,
        profile: updateUser.profile
          ? {
              displayName: updateUser.profile.displayName,
              bio: updateUser.profile.bio,
              avatarUrl: updateUser.profile.avatarUrl,
            }
          : null,
      },
    };
  }

  async promoteUserToModerator(targetUserId: string, actorUserId: string) {
    const promoteUser = await this.prisma.client.user.findUnique({
      where: { id: targetUserId },
      include: { profile: true },
    });

    if (!promoteUser) {
      throw new NotFoundException('user does not exist');
    }

    if (promoteUser.globalRole !== 'USER') {
      throw new BadRequestException('his Role is not USER');
    }

    if (promoteUser.isBanned === true) {
      throw new BadRequestException('user is banned');
    }

    const updateUser = await this.prisma.client.user.update({
      where: { id: targetUserId },
      data: { isBanned: false, isActive: true, globalRole: 'MODERATOR' },
      include: { profile: true },
    });

    await this.notifyUser(targetUserId, {
      type: 'SYSTEM',
      title: 'Role updated',
      body: 'You were promoted to moderator.',
      actorId: actorUserId,
      entityType: 'user',
      entityId: targetUserId,
      action: 'admin_user_promoted',
      metadata: {
        newRole: updateUser.globalRole,
      },
    });

    return {
      message: 'user promoted to moderator',
      user: {
        id: updateUser.id,
        email: updateUser.email,
        username: updateUser.username,
        globalRole: updateUser.globalRole,
        isActive: updateUser.isActive,
        isBanned: updateUser.isBanned,
        profile: updateUser.profile
          ? {
              displayName: updateUser.profile.displayName,
              bio: updateUser.profile.bio,
              avatarUrl: updateUser.profile.avatarUrl,
            }
          : null,
      },
    };
  }

  async unpromoteModeratorToUser(targetUserId: string, actorUserId: string) {
    const unpromoteModerator = await this.prisma.client.user.findUnique({
      where: { id: targetUserId },
      include: { profile: true },
    });

    if (!unpromoteModerator) {
      throw new NotFoundException('user does not exist');
    }

    if (unpromoteModerator.globalRole !== 'MODERATOR') {
      throw new BadRequestException('his Role is not MODERATOR');
    }

    if (unpromoteModerator.isBanned === true) {
      throw new BadRequestException('user is banned');
    }

    const updateUser = await this.prisma.client.user.update({
      where: { id: targetUserId },
      data: { isBanned: false, isActive: true, globalRole: 'USER' },
      include: { profile: true },
    });

    await this.notifyUser(targetUserId, {
      type: 'SYSTEM',
      title: 'Role updated',
      body: 'Your moderator role was removed.',
      actorId: actorUserId,
      entityType: 'user',
      entityId: targetUserId,
      action: 'admin_user_unpromoted',
      metadata: {
        newRole: updateUser.globalRole,
      },
    });

    return {
      message: 'moderator unpromoted to user',
      user: {
        id: updateUser.id,
        email: updateUser.email,
        username: updateUser.username,
        globalRole: updateUser.globalRole,
        isActive: updateUser.isActive,
        isBanned: updateUser.isBanned,
        profile: updateUser.profile
          ? {
              displayName: updateUser.profile.displayName,
              bio: updateUser.profile.bio,
              avatarUrl: updateUser.profile.avatarUrl,
            }
          : null,
      },
    };
  }
}
