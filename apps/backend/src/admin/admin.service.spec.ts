import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatGateway } from '../chat/chat.gateway';
import {
  jest,
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
} from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  let service: AdminService;
  let prismaMock: DeepMockProxy<PrismaService>;
  let chatGateway: ChatGateway;

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock = mockDeep<PrismaService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prismaMock },
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
    chatGateway = module.get<ChatGateway>(ChatGateway);
    jest
      .spyOn(service as any, 'notifyUser')
      .mockResolvedValue({ body: 'mocked' });
  });

  describe('banUser', () => {
    it('Scenario 1 - should throw BadRequest if banning self', async () => {
      await expect(service.banUser('user1', 'user1')).rejects.toThrow(
        new BadRequestException('User cannot ban himself...'),
      );
    });

    it('Scenario 2 - should throw NotFoundException if targetUser not found', async () => {
      prismaMock.client.user.findUnique.mockResolvedValue(null); //nothing found ind DB
      await expect(service.banUser('targetUser', 'actorUser')).rejects.toThrow(
        new NotFoundException('User to ban does not exist'),
      );
    });

    it('Scenario 3 - should throw BadRequestException if targetUser banned', async () => {
      const mockUser = {
        id: 'target-uuid',
        username: 'userBanned',
        isBanned: true,
      };
      prismaMock.client.user.findUnique.mockResolvedValue(mockUser as any);
      await expect(service.banUser(mockUser.id, 'actorUser')).rejects.toThrow(
        new BadRequestException('User already banned'),
      );
    });

    it('Scenario 4 - should update the user banned and token should be refreshed', async () => {
      const mockUser = {
        id: 'target-uuid',
        username: 'userBanned',
        isBanned: true,
      };
      prismaMock.client.user.findUnique.mockResolvedValue(mockUser as any);
      await expect(service.banUser(mockUser.id, 'actorUser')).rejects.toThrow(
        new BadRequestException('User already banned'),
      );
    });

    it('Scenario 5 - should successfully ban user and disconnect them', async () => {
      const targetId = 'target';
      const actorId = 'admin';
      const mockUser = {
        id: targetId,
        username: 'victim',
        globalRole: 'USER',
        isActive: true,
        isBanned: false,
        profile: { displayName: 'Victim' },
      };
      const updatedUserMock = {
        ...mockUser,
        isBanned: true,
        isActive: false,
      };
      prismaMock.client.user.findUnique
        .mockResolvedValueOnce(mockUser as any)
        .mockResolvedValueOnce({ globalRole: 'ADMIN' } as any);
      prismaMock.client.$transaction.mockResolvedValue([
        updatedUserMock, // This is what [updateUser] will receive
        { id: 'refreshToken1', userId: 'targetId' }, // This is for the second op in the transaction
      ]);

      const result = await service.banUser(targetId, actorId);

      expect(result.message).toBe('user banned');
      expect(prismaMock.client.$transaction).toHaveBeenCalled();
      expect(chatGateway.emitModerationBanAndDisconnect).toHaveBeenCalledWith(
        targetId,
        expect.anything(),
      );
    });
  });

  describe('unbanUser', () => {
    it('Scenario 1 - should throw BadRequest if banning self', async () => {
      await expect(service.unbanUser('user1', 'user1')).rejects.toThrow(
        new BadRequestException('user cannot unban himself...'),
      );
    });

    it('Scenario 2 - should throw NotFoundException if targetUser not found', async () => {
      prismaMock.client.user.findUnique.mockResolvedValue(null); //nothing found ind DB
      await expect(
        service.unbanUser('targetUser', 'actorUser'),
      ).rejects.toThrow(new NotFoundException('user to unban does not exist'));
    });

    it('Scenario 3 - should throw BadRequestException if targetUser not banned', async () => {
      const mockUser = {
        id: 'target-uuid',
        username: 'userNotBanned',
        isBanned: false,
      };
      prismaMock.client.user.findUnique.mockResolvedValue(mockUser as any);
      await expect(service.unbanUser(mockUser.id, 'actorUser')).rejects.toThrow(
        new BadRequestException('user is not banned'),
      );
    });

    it('Scenario 4 - should successfully unban user and set as active', async () => {
      const targetId = 'target';
      const actorId = 'admin';
      const mockUser = {
        id: targetId,
        email: 'victim@gmail.com',
        username: 'victim',
        globalRole: 'USER',
        penaltyPoints: -500,
        isActive: false,
        isBanned: true,
        profile: { displayName: 'Victim' },
      };

      prismaMock.client.user.findUnique.mockResolvedValue(mockUser as any);
      prismaMock.client.user.update.mockResolvedValue({
        ...mockUser,
        penaltyPoints: 0,
        isBanned: false,
        isActive: true,
      } as any);

      const result = await service.unbanUser(targetId, actorId);

      expect(result.message).toBe('user unbanned');
      expect(result.user.penaltyPoints).toBe(0);
      expect(prismaMock.client.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: targetId },
          data: { isBanned: false, isActive: true, penaltyPoints: 0 },
        }),
      );
    });
  });

  describe('promoteUserToModerator', () => {
    it('Scenario 1 - should throw NotFoundException if targetUser not found', async () => {
      prismaMock.client.user.findUnique.mockResolvedValue(null); //nothing found ind DB
      await expect(
        service.promoteUserToModerator('targetUser', 'admin'),
      ).rejects.toThrow(new NotFoundException('user does not exist'));
    });

    it('Scenario 2 - should throw BadRequestException if targetUser is not an USER not found', async () => {
      prismaMock.client.user.findUnique.mockResolvedValue({
        globalRole: 'MODERATOR',
      } as any);

      await expect(
        service.promoteUserToModerator('targetUser', 'admin'),
      ).rejects.toThrow(new BadRequestException('his Role is not USER'));
    });

    it('Scenario 3 - should throw BadRequest if user is banned', async () => {
      prismaMock.client.user.findUnique.mockResolvedValue({
        globalRole: 'USER',
        isBanned: true,
      } as any);

      await expect(
        service.promoteUserToModerator('u1', 'admin'),
      ).rejects.toThrow(new BadRequestException('user is banned'));
    });

    it('Scenario 4 - should successfully promote a USER to MODERATOR', async () => {
      const mockUser = { id: 'u1', globalRole: 'USER', isBanned: false };
      prismaMock.client.user.findUnique.mockResolvedValue(mockUser as any);
      prismaMock.client.user.update.mockResolvedValue({
        ...mockUser,
        globalRole: 'MODERATOR',
      } as any);

      const result = await service.promoteUserToModerator('u1', 'admin');

      expect(result.user.globalRole).toBe('MODERATOR');
    });
  });

  describe('unpromoteModeratorToUser', () => {
    it('Scenario 1 - should throw NotFoundException if targetUser not found', async () => {
      prismaMock.client.user.findUnique.mockResolvedValue(null); //nothing found ind DB
      await expect(
        service.unpromoteModeratorToUser('targetUser', 'admin'),
      ).rejects.toThrow(new NotFoundException('user does not exist'));
    });

    it('Scenario 2 - should throw BadRequestException if targetUser is not a MODERATOR not found', async () => {
      prismaMock.client.user.findUnique.mockResolvedValue({
        globalRole: 'USER',
      } as any);

      await expect(
        service.unpromoteModeratorToUser('targetUser', 'admin'),
      ).rejects.toThrow(new BadRequestException('his Role is not MODERATOR'));
    });

    it('Scenario 3 - should throw BadRequest if user is banned', async () => {
      prismaMock.client.user.findUnique.mockResolvedValue({
        globalRole: 'MODERATOR',
        isBanned: true,
      } as any);

      await expect(
        service.unpromoteModeratorToUser('u1', 'admin'),
      ).rejects.toThrow(new BadRequestException('user is banned'));
    });

    it('Scenario 4 - should successfully unpromote a MODERATOR to USER', async () => {
      const mockUser = { id: 'u1', globalRole: 'MODERATOR', isBanned: false };
      prismaMock.client.user.findUnique.mockResolvedValue(mockUser as any);
      prismaMock.client.user.update.mockResolvedValue({
        ...mockUser,
        globalRole: 'USER',
      } as any);

      const result = await service.unpromoteModeratorToUser('u1', 'admin');

      expect(result.user.globalRole).toBe('USER');
    });
  });

  afterEach(() => {
    jest.restoreAllMocks(); // This cleans up spyOn mocks
  });
});
