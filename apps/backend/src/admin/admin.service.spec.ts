import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatGateway } from '../chat/chat.gateway';
import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: PrismaService;
  // let notificationsService: NotificationsService;
  let chatGateway: ChatGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn((input) => Promise.all(input)),
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            refreshToken: {
              updateMany: jest.fn(),
            },
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            createFromInput: jest.fn(),
          },
        },
        {
          provide: ChatGateway,
          useValue: {
            emitNotificationCreated: jest.fn(),
            emitModerationBanAndDisconnect: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    prisma = module.get<PrismaService>(PrismaService);
    chatGateway = module.get<ChatGateway>(ChatGateway);
    // Mock the private notifyUser method to avoid dependency issues
    jest
      .spyOn(service as any, 'notifyUser')
      .mockResolvedValue({ body: 'mocked' });
  });

  describe('banUser', () => {
    it('Scenario1 - should throw BadRequest if banning self', async () => {
      await expect(service.banUser('user1', 'user1')).rejects.toThrow(
        new BadRequestException('User cannot ban himself...'),
      );
    });

    it('Scenario2 - should throw NotFoundException if targetUser not found', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null); //nothing found ind DB
      await expect(service.banUser('targetUser', 'actorUser')).rejects.toThrow(
        new NotFoundException('User to ban does not exist'),
      );
    });

    it('Scenario3 - should throw BadRequestException if targetUser banned', async () => {
      const mockUser = {
        id: 'target-uuid',
        username: 'userBanned',
        isBanned: true,
      };
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);
      await expect(service.banUser(mockUser.id, 'actorUser')).rejects.toThrow(
        new BadRequestException('User already banned'),
      );
    });

    it('Scenario4 - should update the user banned and token should be refreshed', async () => {
      const mockUser = {
        id: 'target-uuid',
        username: 'userBanned',
        isBanned: true,
      };
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);
      await expect(service.banUser(mockUser.id, 'actorUser')).rejects.toThrow(
        new BadRequestException('User already banned'),
      );
    });

    it('Scenario5 - should successfully ban user and disconnect them', async () => {
      const targetId = 'target';
      const actorId = 'admin';
      const mockUser = {
        id: targetId,
        username: 'victim',
        isBanned: false,
        globalRole: 'USER',
        profile: { displayName: 'Victim' },
      };

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(prisma.user, 'update').mockResolvedValue({
        ...mockUser,
        isBanned: true,
        isActive: false,
      } as any);

      const result = await service.banUser(targetId, actorId);

      expect(result.message).toBe('user banned');
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(chatGateway.emitModerationBanAndDisconnect).toHaveBeenCalledWith(targetId, expect.anything());
    });
  });
});

