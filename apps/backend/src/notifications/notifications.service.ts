import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createForUser(
    userId: string,
    type: 'MESSAGE' | 'MODERATION' | 'SYSTEM',
    title: string,
    body?: string,
  ) {
    return this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
      },
    });
  }

  async createForMany(
    userIds: string[],
    type: 'MESSAGE' | 'MODERATION' | 'SYSTEM',
    title: string,
    body?: string,
  ) {
    return Promise.all(
      userIds.map((userId) =>
        this.prisma.notification.create({
          data: {
            userId,
            type,
            title,
            body,
          },
        }),
      ),
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