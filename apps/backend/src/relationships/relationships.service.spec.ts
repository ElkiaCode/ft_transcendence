import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { RelationshipsService } from './relationships.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatGateway } from '../chat/chat.gateway';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { jest, describe, beforeEach, it, expect } from '@jest/globals';

describe('RelationshipsService', () => {
  let service: RelationshipsService;
  let prismaMock: DeepMockProxy<PrismaService>;
  let notificationsService: NotificationsService;
  let gateway: ChatGateway;

  // Mock Data
  const mockUser = {
    id: 'user-1',
    username: 'alice',
    isActive: true,
    isBanned: false,
  };
  const mockTarget = {
    id: 'user-2',
    username: 'bob',
    isActive: true,
    isBanned: false,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock = mockDeep<PrismaService>();
    prismaMock.client.$transaction.mockImplementation((promises) => {
      if (Array.isArray(promises)) {
        return Promise.all(promises);
      }
      return Promise.resolve(promises);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RelationshipsService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: NotificationsService,
          useValue: {
            createFromInput: jest.fn().mockImplementation(() =>
              Promise.resolve({
                id: 'notif-1',
              } as unknown as Awaited<
                ReturnType<NotificationsService['createFromInput']>
              >),
            ),
          },
        },
        {
          provide: ChatGateway,
          useValue: { emitNotificationCreated: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<RelationshipsService>(RelationshipsService);
    notificationsService =
      module.get<NotificationsService>(NotificationsService);
    gateway = module.get<ChatGateway>(ChatGateway);
  });

  describe('sendFriendRequest', () => {
    it('Scenario 1: should throw BadRequest if user targets themselves', async () => {
      await expect(
        service.sendFriendRequest('user-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('Scenario 2: should throw BadRequest if a block exists', async () => {
      prismaMock.client.user.findUnique.mockResolvedValueOnce(mockUser as any);
      prismaMock.client.user.findUnique.mockResolvedValueOnce(
        mockTarget as any,
      );

      // Mock finding an existing block
      prismaMock.client.block.findFirst.mockResolvedValue({
        id: 'block-1',
        createdAt: new Date(),
        blockerId: '',
        blockedId: '',
      });

      await expect(
        service.sendFriendRequest('user-1', 'user-2'),
      ).rejects.toThrow(
        new BadRequestException(
          'friend request not allowed because one user has blocked the other',
        ),
      );
    });

    it('Scenario 3: should successfully create a friend request and notify the user', async () => {
      prismaMock.client.user.findUnique.mockResolvedValueOnce(mockUser as any);
      prismaMock.client.user.findUnique.mockResolvedValueOnce(
        mockTarget as any,
      );
      prismaMock.client.block.findFirst.mockResolvedValue(null);
      prismaMock.client.friendship.findFirst.mockResolvedValue(null);

      const mockFriendship = {
        id: 'f-1',
        requesterId: 'user-1',
        addresseeId: 'user-2',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prismaMock.client.friendship.create.mockResolvedValue(
        mockFriendship as any,
      );

      const result = await service.sendFriendRequest('user-1', 'user-2');

      expect(result['message']).toBe('friend request sent');
      expect(prismaMock.client.friendship.create).toHaveBeenCalled();
      expect(notificationsService['createFromInput']).toHaveBeenCalled();
      expect(gateway['emitNotificationCreated']).toHaveBeenCalledWith(
        'user-2',
        expect.anything(),
      );
    });
  });

  describe('acceptFriendRequest', () => {
    it('Scenario 1: should throw NotFound if no pending request exists', async () => {
      prismaMock.client.user.findUnique.mockResolvedValue(mockUser as any);
      prismaMock.client.block.findFirst.mockResolvedValue(null);
      prismaMock.client.friendship.findFirst.mockResolvedValue(null);

      await expect(
        service.acceptFriendRequest('user-1', 'user-2'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('blockUser', () => {
    it('Scenario 1: should create a block and delete existing friendship in a transaction', async () => {
      prismaMock.client.user.findUnique.mockResolvedValueOnce(mockUser as any);
      prismaMock.client.user.findUnique.mockResolvedValueOnce(
        mockTarget as any,
      );

      prismaMock.client.block.findUnique.mockResolvedValue(null); // No existing block
      const mockFriendship = { id: 'f-1', status: 'PENDING' };
      prismaMock.client.friendship.findFirst.mockResolvedValue(
        mockFriendship as any,
      );

      const mockBlock = { id: 'b-1', blockerId: 'user-1', blockedId: 'user-2' };
      prismaMock.client.block.create.mockResolvedValue(mockBlock as any);
      prismaMock.client.friendship.delete.mockResolvedValue(
        mockFriendship as any,
      );

      const result = await service.blockUser('user-1', 'user-2');

      expect(prismaMock.client.$transaction).toHaveBeenCalled();
      expect(prismaMock.client.block.create).toHaveBeenCalledWith({
        data: { blockerId: 'user-1', blockedId: 'user-2' },
      });
      expect(prismaMock.client.friendship.delete).toHaveBeenCalledWith({
        where: { id: 'f-1' },
      });
      expect(result.friendshipRemoved).toBe(true);
      expect(result.block.id).toBe('b-1');
      expect(notificationsService['createFromInput']).toHaveBeenCalledWith(
        'user-2',
        expect.objectContaining({
          action: 'user_blocked',
          entityType: 'block',
          entityId: 'b-1',
        }),
      );
      expect(gateway['emitNotificationCreated']).toHaveBeenCalledWith(
        'user-2',
        expect.anything(),
      );
    });
  });

  describe('unblockUser', () => {
    it('deletes the block and notifies the unblocked user', async () => {
      prismaMock.client.user.findUnique.mockResolvedValueOnce(mockUser as any);
      prismaMock.client.user.findUnique.mockResolvedValueOnce(
        mockTarget as any,
      );
      prismaMock.client.block.findUnique.mockResolvedValue({
        id: 'b-1',
        blockerId: 'user-1',
        blockedId: 'user-2',
        createdAt: new Date(),
      });
      prismaMock.client.block.delete.mockResolvedValue({
        id: 'b-1',
        blockerId: 'user-1',
        blockedId: 'user-2',
        createdAt: new Date(),
      });

      await service.unblockUser('user-1', 'user-2');

      expect(notificationsService['createFromInput']).toHaveBeenCalledWith(
        'user-2',
        expect.objectContaining({
          action: 'user_unblocked',
          entityType: 'block',
          entityId: 'b-1',
        }),
      );
      expect(gateway['emitNotificationCreated']).toHaveBeenCalledWith(
        'user-2',
        expect.anything(),
      );
    });
  });
});
