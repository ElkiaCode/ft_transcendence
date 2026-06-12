import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { ChatGateway } from '../chat/chat.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminService } from './admin.service';

describe('AdminService moderation hierarchy', () => {
  function createService() {
    const findUnique = jest.fn();
    const transaction = jest.fn();
    const prisma = {
      client: {
        user: {
          findUnique,
          update: jest.fn(),
        },
        refreshToken: {
          updateMany: jest.fn(),
        },
        $transaction: transaction,
      },
    };

    const service = new AdminService(
      prisma as unknown as PrismaService,
      {
        createFromInput: jest.fn(),
      } as unknown as NotificationsService,
      {
        emitNotificationCreated: jest.fn(),
        emitModerationBanAndDisconnect: jest.fn(),
      } as unknown as ChatGateway,
    );

    return { service, findUnique, transaction };
  }

  it.each(['MODERATOR', 'ADMIN'] as const)(
    'prevents a moderator from banning a %s',
    async (targetRole) => {
      const { service, findUnique, transaction } = createService();

      findUnique
        .mockResolvedValueOnce({
          id: 'target',
          globalRole: targetRole,
          isBanned: false,
        })
        .mockResolvedValueOnce({ globalRole: 'MODERATOR' });

      await expect(service.banUser('target', 'actor')).rejects.toThrow(
        new ForbiddenException(
          'Moderators cannot ban administrators or other moderators',
        ),
      );
      expect(transaction).not.toHaveBeenCalled();
    },
  );
});
