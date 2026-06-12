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

  private async notifyModerators(
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

      const targetUser = await this.prisma.client.user.findUnique({
        where: { id: targetUserId },
      });

      if (!targetUser) {
        throw new NotFoundException('target user not found');
      }

      const report = await this.prisma.client.report.create({
        data: {
          creatorId,
          targetType: 'USER',
          targetUserId,
          reason: reason.trim(),
        },
      });

      await this.notifyModerators(
        {
          type: 'MODERATION',
          title: 'New user report',
          body: 'A user report needs review.',
          actorId: creatorId,
          entityType: 'report',
          entityId: report.id,
          action: 'report_created',
          metadata: {
            targetType: 'USER',
            targetUserId,
          },
        },
        creatorId,
      );

      return report;
    }

    if (targetType === 'MESSAGE') {
      if (!targetMessageId) {
        throw new BadRequestException('targetMessageId is required');
      }

      const targetMessage = await this.prisma.client.message.findUnique({
        where: { id: targetMessageId },
      });

      if (!targetMessage) {
        throw new NotFoundException('target message not found');
      }

      const report = await this.prisma.client.report.create({
        data: {
          creatorId,
          targetType: 'MESSAGE',
          targetMessageId,
          targetUserId: targetMessage.senderId,
          reason: reason.trim(),
        },
      });

      await this.notifyModerators(
        {
          type: 'MODERATION',
          title: 'New message report',
          body: 'A message report needs review.',
          actorId: creatorId,
          entityType: 'report',
          entityId: report.id,
          action: 'report_created',
          metadata: {
            targetType: 'MESSAGE',
            targetMessageId,
          },
        },
        creatorId,
      );

      return report;
    }

    throw new BadRequestException('invalid targetType');
  }

  async listReports() {
    return this.prisma.client.report.findMany({
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            profile: {
              select: {
                avatarUrl: true,
              },
            },
          },
        },
        targetUser: {
          select: {
            id: true,
            username: true,
            profile: {
              select: {
                avatarUrl: true,
              },
            },
          },
        },
        targetMessage: {
          select: {
            id: true,
            content: true,
            sender: {
              select: {
                id: true,
                username: true,
              },
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
    const report = await this.prisma.client.report.findUnique({
      where: { id: reportId },
      include: {
        targetMessage: {
          select: {
            sender: {
              select: {
                id: true,
                globalRole: true,
              },
            },
          },
        },
        targetUser: {
          select: {
            id: true,
            globalRole: true,
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundException('report not found');
    }

    if (report.status !== 'OPEN') {
      throw new BadRequestException('report has already been reviewed');
    }

    const moderator = await this.prisma.client.user.findUnique({
      where: { id: moderatorId },
      select: {
        id: true,
        globalRole: true,
      },
    });

    if (!moderator || !['ADMIN', 'MODERATOR'].includes(moderator.globalRole)) {
      throw new ForbiddenException('user cannot perform moderation actions');
    }

    const targetUserId =
      report.targetUserId ?? report.targetMessage?.sender.id ?? null;
    const targetGlobalRole =
      report.targetUser?.globalRole ??
      report.targetMessage?.sender.globalRole ??
      null;

    if (
      action !== 'DISMISS_REPORT' &&
      moderator.globalRole === 'MODERATOR' &&
      targetGlobalRole !== 'USER'
    ) {
      throw new ForbiddenException(
        'moderators cannot moderate administrators or other moderators',
      );
    }

    const isSystemMessage = report.creatorId === null;

    const penaltyPointsChange =
      targetUserId && action !== 'DISMISS_REPORT' && penaltyPointsToSubtract > 0
        ? -penaltyPointsToSubtract
        : 0;
    const nextStatus = action === 'DISMISS_REPORT' ? 'DISMISSED' : 'RESOLVED';

    const result = await this.prisma.client.$transaction(async (tx) => {
      const claimedReport = await tx.report.updateMany({
        where: {
          id: reportId,
          status: 'OPEN',
        },
        data: {
          status: nextStatus,
        },
      });

      if (claimedReport.count !== 1) {
        throw new BadRequestException('report has already been reviewed');
      }

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

      const updatedReport = {
        ...report,
        status: nextStatus,
      };

      let updatedTargetUser: {
        id: string;
        penaltyPoints: number;
        isBanned: boolean;
      } | null = null;

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
          where: { id: targetUserId, globalRole: { not: 'ADMIN' } },
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

    if (isSystemMessage || action === 'BAN' || action === 'WARN') {
      await this.notifyUser(targetUserId, {
        type: 'MODERATION',
        title: 'Moderation update',
        body: note ?? action,
        actorId: moderatorId,
        entityType: 'report',
        entityId: reportId,
        action: `report_${action.toLowerCase()}`,
        metadata: {
          reportId,
          moderationActionId: result.moderationAction.id,
          penaltyPointsChange,
        },
      });

      if (action === 'BAN') {
        await this.chatGateway.emitModerationBanAndDisconnect(targetUserId, {
          message: 'Your account was banned by moderation.',
          reason: note ?? action,
        });
      }
    }

    if (!isSystemMessage) {
      if (action !== 'DISMISS_REPORT') {
        await this.notifyUser(report.creatorId!, {
          type: 'MODERATION',
          title: 'Flag taken into account',
          body: note ?? action,
          actorId: moderatorId,
          entityType: 'report',
          entityId: reportId,
          action: `report_${action.toLowerCase()}`,
          metadata: {
            reportId,
            moderationActionId: result.moderationAction.id,
            penaltyPointsChange,
          },
        });
      } else {
        await this.notifyUser(report.creatorId!, {
          type: 'MODERATION',
          title: 'Flag refused',
          body: note ?? action,
          actorId: moderatorId,
          entityType: 'report',
          entityId: reportId,
          action: `report_${action.toLowerCase()}`,
          metadata: {
            reportId,
            moderationActionId: result.moderationAction.id,
            penaltyPointsChange,
          },
        });
      }
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
      throw new BadRequestException(
        'you cannot adjust your own penalty points',
      );
    }

    const [moderator, targetUser] = await Promise.all([
      this.prisma.client.user.findUnique({
        where: { id: moderatorId },
        select: {
          id: true,
          globalRole: true,
        },
      }),
      this.prisma.client.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          penaltyPoints: true,
          globalRole: true,
        },
      }),
    ]);

    if (!targetUser) {
      throw new NotFoundException('target user not found');
    }

    if (!moderator || !['ADMIN', 'MODERATOR'].includes(moderator.globalRole)) {
      throw new ForbiddenException('user cannot perform moderation actions');
    }

    if (
      moderator.globalRole === 'MODERATOR' &&
      targetUser.globalRole !== 'USER'
    ) {
      throw new ForbiddenException(
        'moderators cannot modify points of administrators or other moderators',
      );
    }

    const result = await this.prisma.client.$transaction(async (tx) => {
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

    await this.notifyUser(targetUserId, {
      type: 'MODERATION',
      title: 'Penalty points updated',
      body: note ?? `Penalty points changed by ${points}`,
      actorId: moderatorId,
      entityType: 'user',
      entityId: targetUserId,
      action: 'penalty_points_updated',
      metadata: {
        moderationActionId: result.moderationAction.id,
        points,
        newPenaltyPoints: result.user.penaltyPoints,
        promoted: Boolean(result.promoted),
      },
    });

    if (result.promoted) {
      await this.notifyUser(targetUserId, {
        type: 'SYSTEM',
        title: 'Role updated',
        body: 'You were promoted to moderator after earning enough points.',
        actorId: moderatorId,
        entityType: 'user',
        entityId: targetUserId,
        action: 'user_auto_promoted',
        metadata: {
          newRole: result.user.globalRole,
          penaltyPoints: result.user.penaltyPoints,
        },
      });
    }

    if (result.user.isBanned) {
      await this.chatGateway.emitModerationBanAndDisconnect(targetUserId, {
        message: 'Your account was banned by moderation.',
        reason: note ?? `Penalty points changed by ${points}`,
        penaltyPoints: result.user.penaltyPoints,
      });
    }

    return result;
  }
}
