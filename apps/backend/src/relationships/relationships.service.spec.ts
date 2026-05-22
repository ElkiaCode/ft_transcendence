import { Test, TestingModule } from '@nestjs/testing';
import { RelationshipsService } from './relationships.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatGateway } from '../chat/chat.gateway';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { Notification } from '@prisma/client'; // Import the type from Prisma
import { Friendship, FriendshipStatus } from '@prisma/client';

//   afterEach,

describe('RelationshipsService', () => {
  let service: RelationshipsService;
  let prisma: PrismaService;
  let notifications: NotificationsService;
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
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RelationshipsService,
        {
          provide: PrismaService,
          useValue: {
            user: { findUnique: jest.fn() },
            block: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              delete: jest.fn(),
            },
            friendship: {
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              findMany: jest.fn(),
            },
            $transaction: jest.fn((promises: any[]) => Promise.all(promises)),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            // Cast to unknown first to break the 'never' link, then to the actual type
            createFromInput: jest
              .fn()
              .mockResolvedValue({ id: 'notif-1' } as unknown as Notification),
          },
        },
        {
          provide: ChatGateway,
          useValue: { emitNotificationCreated: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<RelationshipsService>(RelationshipsService);
    prisma = module.get<PrismaService>(PrismaService);
    notifications = module.get<NotificationsService>(NotificationsService);
    gateway = module.get<ChatGateway>(ChatGateway);
  });

  describe('sendFriendRequest', () => {
    it('should throw BadRequest if user targets themselves', async () => {
      await expect(
        service.sendFriendRequest('user-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequest if a block exists', async () => {
      // Mock finding users
      jest
        .spyOn(prisma.user, 'findUnique')
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        .mockResolvedValueOnce(mockUser as any)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        .mockResolvedValueOnce(mockTarget as any);

      // Mock finding an existing block
      jest.spyOn(prisma.block, 'findFirst').mockResolvedValue({
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

    it('should successfully create a friend request and notify the user', async () => {
      jest
        .spyOn(prisma.user, 'findUnique')
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        .mockResolvedValueOnce(mockUser as any)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        .mockResolvedValueOnce(mockTarget as any);
      jest.spyOn(prisma.block, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.friendship, 'findFirst').mockResolvedValue(null);

      const mockFriendship = {
        id: 'f-1',
        requesterId: 'user-1',
        addresseeId: 'user-2',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      jest
        .spyOn(prisma.friendship, 'create')
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        .mockResolvedValue(mockFriendship as any);

      const result = await service.sendFriendRequest('user-1', 'user-2');

      expect(result['message']).toBe('friend request sent');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.friendship.create).toHaveBeenCalled();
      expect(notifications['createFromInput']).toHaveBeenCalled();
      expect(gateway['emitNotificationCreated']).toHaveBeenCalledWith(
        'user-2',
        expect.anything(),
      );
    });
  });

  describe('blockUser', () => {
    it('should create a block and delete existing friendship in a transaction', async () => {
      jest
        .spyOn(prisma.user, 'findUnique')
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        .mockResolvedValueOnce(mockUser as any)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        .mockResolvedValueOnce(mockTarget as any);

      jest.spyOn(prisma.block, 'findUnique').mockResolvedValue(null); // No existing block
      jest.spyOn(prisma.friendship, 'findFirst').mockResolvedValue({
        id: 'f-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        requesterId: '',
        addresseeId: '',
        status: 'PENDING',
      }); // Existing friendship

      const mockBlock = { id: 'b-1', blockerId: 'user-1', blockedId: 'user-2' };
      jest.spyOn(prisma.block, 'create').mockResolvedValue(mockBlock as any);

      const result = await service.blockUser('user-1', 'user-2');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.$transaction).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.friendship.delete).toHaveBeenCalledWith({
        where: { id: 'f-1' },
      });
      expect(result.friendshipRemoved).toBe(true);
    });
  });

  describe('acceptFriendRequest', () => {
    it('should throw NotFound if no pending request exists', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(prisma.block, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.friendship, 'findFirst').mockResolvedValue(null);

      await expect(
        service.acceptFriendRequest('user-1', 'user-2'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
