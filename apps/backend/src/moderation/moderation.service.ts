import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatGateway } from '../chat/chat.gateway';

@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly chatGateway: ChatGateway,
  ) {}

  async createReport(
    creatorId: string,
    targetType: 'USER' | 'MESSAGE',
    targetUserId: string | undefined,
    targetMessageId: string | undefined,
    reason: string,
  ) {
    if (targetType === 'USER') {
      if (!targetUserId) {
        throw new BadRequestException('targetUserId is required');
      }

      if (creatorId === targetUserId) {
        throw new BadRequestException('cannot report yourself');
      }

      const targetUser = await this.prisma.user.findUnique({
        where: { id: targetUserId },
      });

      if (!targetUser) {
        throw new NotFoundException('target user not found');
      }

      return this.prisma.report.create({
        data: {
          creatorId,
          targetType: 'USER',
          targetUserId,
          reason: reason.trim(),
        },
      });
    }

    if (targetType === 'MESSAGE') {
      if (!targetMessageId) {
        throw new BadRequestException('targetMessageId is required');
      }

      const targetMessage = await this.prisma.message.findUnique({
        where: { id: targetMessageId },
      });

      if (!targetMessage) {
        throw new NotFoundException('target message not found');
      }

      return this.prisma.report.create({
        data: {
          creatorId,
          targetType: 'MESSAGE',
          targetMessageId,
          reason: reason.trim(),
        },
      });
    }

    throw new BadRequestException('invalid targetType');
  }

  async listReports() {
    return this.prisma.report.findMany({
      include: {
        creator: {
          include: { profile: true },
        },
        targetUser: {
          include: { profile: true },
        },
        targetMessage: {
          include: {
            sender: {
              include: { profile: true },
            },
          },
        },
        actions: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reviewReport(
    moderatorId: string,
    reportId: string,
    action: 'WARN' | 'BAN' | 'UNBAN' | 'DISMISS_REPORT',
    note?: string,
  ) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException('report not found');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const moderationAction = await tx.moderationAction.create({
        data: {
          reportId,
          moderatorId,
          targetUserId: report.targetUserId ?? undefined,
          action,
          note,
        },
      });

      const updatedReport = await tx.report.update({
        where: { id: reportId },
        data: {
          status: action === 'DISMISS_REPORT' ? 'DISMISSED' : 'RESOLVED',
        },
      });

      if (action === 'BAN' && report.targetUserId) {
        await tx.user.update({
          where: { id: report.targetUserId },
          data: {
            isBanned: true,
            isActive: false,
          },
        });

        await tx.refreshToken.updateMany({
          where: {
            userId: report.targetUserId,
            revokedAt: null,
          },
          data: {
            revokedAt: new Date(),
          },
        });
      }

      if (action === 'UNBAN' && report.targetUserId) {
        await tx.user.update({
          where: { id: report.targetUserId },
          data: {
            isBanned: false,
            isActive: true,
          },
        });
      }

      return { moderationAction, updatedReport };
    });

    if (report.targetUserId) {
      const notification = await this.notificationsService.createForUser(
        report.targetUserId,
        'MODERATION',
        'Moderation update',
        note ?? action,
      );

      await this.chatGateway.emitNotificationCreated(
        report.targetUserId,
        notification,
      );
    }

    return result;
  }
}