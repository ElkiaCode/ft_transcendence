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
    penaltyPointsToSubtract = 0,
  ) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: {
        targetMessage: {
          select: {
            senderId: true,
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundException('report not found');
    }

    const targetUserId = report.targetUserId ?? report.targetMessage?.senderId;
    const penaltyPointsChange =
      targetUserId && penaltyPointsToSubtract > 0 ? -penaltyPointsToSubtract : 0;

    const result = await this.prisma.$transaction(async (tx) => {
      const moderationAction = await tx.moderationAction.create({
        data: {
          reportId,
          moderatorId,
          targetUserId,
          action,
          note,
          penaltyPointsChange,
        },
      });

      const updatedReport = await tx.report.update({
        where: { id: reportId },
        data: {
          status: action === 'DISMISS_REPORT' ? 'DISMISSED' : 'RESOLVED',
        },
      });

      let updatedTargetUser: { id: string; penaltyPoints: number; isBanned: boolean } | null = null;

      if (penaltyPointsChange !== 0 && targetUserId) {
        updatedTargetUser = await tx.user.update({
          where: { id: targetUserId },
          data: {
            penaltyPoints: {
              increment: penaltyPointsChange,
            },
          },
          select: {
            id: true,
            penaltyPoints: true,
            isBanned: true,
          },
        });
      }

      if (
        targetUserId &&
        (action === 'BAN' ||
          (updatedTargetUser && updatedTargetUser.penaltyPoints <= -500))
      ) {
        await tx.user.update({
          where: { id: targetUserId },
          data: {
            isBanned: true,
            isActive: false,
          },
        });

        await tx.refreshToken.updateMany({
          where: {
            userId: targetUserId,
            revokedAt: null,
          },
          data: {
            revokedAt: new Date(),
          },
        });
      }

      if (action === 'UNBAN' && targetUserId) {
        await tx.user.update({
          where: { id: targetUserId },
          data: {
            isBanned: false,
            isActive: true,
          },
        });
      }

      return { moderationAction, updatedReport };
    });

    if (targetUserId) {
      const notification = await this.notificationsService.createForUser(
        targetUserId,
        'MODERATION',
        'Moderation update',
        note ?? action,
      );

      await this.chatGateway.emitNotificationCreated(
        targetUserId,
        notification,
      );
    }

    return result;
  }

  async adjustPenaltyPoints(
    moderatorId: string,
    targetUserId: string,
    points: number,
    note?: string,
  ) {
    if (moderatorId === targetUserId) {
      throw new BadRequestException('you cannot adjust your own penalty points');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        penaltyPoints: true,
      },
    });

    if (!targetUser) {
      throw new NotFoundException('target user not found');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: targetUserId },
        data: {
          penaltyPoints: {
            increment: points,
          },
        },
        select: {
          id: true,
          username: true,
          penaltyPoints: true,
          globalRole: true,
          isBanned: true,
          isActive: true,
        },
      });

      const moderationAction = await tx.moderationAction.create({
        data: {
          moderatorId,
          targetUserId,
          action: 'ADJUST_POINTS',
          note,
          penaltyPointsChange: points,
        },
      });

      if (updatedUser.penaltyPoints <= -500) {
        await tx.user.update({
          where: { id: targetUserId },
          data: {
            isBanned: true,
            isActive: false,
          },
        });

        await tx.refreshToken.updateMany({
          where: {
            userId: targetUserId,
            revokedAt: null,
          },
          data: {
            revokedAt: new Date(),
          },
        });

        return {
          moderationAction,
          user: {
            ...updatedUser,
            isBanned: true,
            isActive: false,
          },
        };
      }

      if (
        updatedUser.penaltyPoints >= 500 &&
        updatedUser.globalRole === 'USER' &&
        updatedUser.isActive &&
        !updatedUser.isBanned
      ) {
        const promotedUser = await tx.user.update({
          where: { id: targetUserId },
          data: {
            globalRole: 'MODERATOR',
          },
          select: {
            id: true,
            username: true,
            penaltyPoints: true,
            globalRole: true,
            isBanned: true,
            isActive: true,
          },
        });

        return {
          moderationAction,
          user: promotedUser,
          promoted: true,
        };
      }

      return { moderationAction, user: updatedUser, promoted: false };
    });

    const notification = await this.notificationsService.createForUser(
      targetUserId,
      'MODERATION',
      'Penalty points updated',
      note ?? `Penalty points changed by ${points}`,
    );

    await this.chatGateway.emitNotificationCreated(targetUserId, notification);

    return result;
  }
}
