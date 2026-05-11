import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../generated/prisma';

type NotificationType = 'MESSAGE' | 'MODERATION' | 'SYSTEM';

type NotificationContext = {
  actorId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  metadata?: Prisma.InputJsonValue;
};

type NotificationInput = NotificationContext & {
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
    return this.prisma.notification.create({
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
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markAsRead(userId: string, notificationId: string) {
    const updated = await this.prisma.notification.updateMany({
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
    await this.prisma.notification.updateMany({
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
