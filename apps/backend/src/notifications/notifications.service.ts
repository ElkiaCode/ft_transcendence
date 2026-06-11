import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
// import type { Prisma } from '../generated/prisma';

export type NotificationType = 'MESSAGE' | 'MODERATION' | 'SYSTEM';

export type NotificationContext = {
  actorId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  metadata?: Prisma.InputJsonValue;
};

export type NotificationInput = NotificationContext & {
  type: NotificationType;
  title: string;
  body?: string;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createForUser(
    userId: string,
    type: NotificationType,
    title: string,
    body?: string,
    context: NotificationContext = {},
  ) {
    return this.prisma.client.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        actorId: context.actorId,
        entityType: context.entityType,
        entityId: context.entityId,
        action: context.action,
        metadata: context.metadata,
      },
    });
  }

  async createForMany(
    userIds: string[],
    type: NotificationType,
    title: string,
    body?: string,
    context: NotificationContext = {},
  ) {
    return Promise.all(
      userIds.map((userId) =>
        this.createForUser(userId, type, title, body, context),
      ),
    );
  }

  async createFromInput(userId: string, input: NotificationInput) {
    return this.createForUser(
      userId,
      input.type,
      input.title,
      input.body,
      input,
    );
  }

  async createFromInputForMany(userIds: string[], input: NotificationInput) {
    return Promise.all(
      userIds.map((userId) => this.createFromInput(userId, input)),
    );
  }

  async listMine(userId: string) {
    // 1. Fetch the user's current memberships to get their 'joinedAt' timestamps
    const memberships =
      await this.prisma.client.conversationParticipant.findMany({
        where: {
          userId,
          leftAt: null, // We only care about groups they are currently IN
        },
        select: {
          conversationId: true,
          joinedAt: true,
        },
      });
    // Create a map for lookup: conversationId -> joinedAt
    const joinDateMap = new Map(
      memberships.map((m) => [m.conversationId, m.joinedAt]),
    );

    // 2. Fetch notifications
    const notifications = await this.prisma.client.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // 3. Filter notifications based on GDPR/Membership rules
    return notifications.filter((notification) => {
      // If the notification isn't linked to a specific entity/conversation, show it (e.g., global system alerts)
      if (!notification.entityId) {
        return true;
      }
      if (notification.entityType === 'CONVERSATION') {
        const userJoinedAt = joinDateMap.get(notification.entityId);
        // If they aren't currently in the conversation linked to this notification,
        // hide it to prevent seeing history from a room they left.
        if (!userJoinedAt || notification.createdAt < userJoinedAt) {
          return false;
        }
      }
      // other types like 'FRIEND_REQUEST',
      // they will pass through here and be shown.
      return true;
    });
  }

  async markAsRead(userId: string, notificationId: string) {
    const updated = await this.prisma.client.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: {
        isRead: true,
      },
    });

    if (updated.count === 0) {
      throw new NotFoundException('notification not found');
    }

    return { success: true };
  }

  async markAllAsRead(userId: string) {
    await this.prisma.client.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return { success: true };
  }
}
