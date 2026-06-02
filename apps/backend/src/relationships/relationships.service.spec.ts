import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { RelationshipsService } from './relationships.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatGateway } from '../chat/chat.gateway';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { User, GlobalRole } from '@prisma/client';

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
    // prisma = module.get<PrismaService>(PrismaService);
    notificationsService =
      module.get<NotificationsService>(NotificationsService);
    gateway = module.get<ChatGateway>(ChatGateway);
  });

  const createMockUser = (overrides: Partial<User> = {}): User => {
    const defaultUser: User = {
      id: 'user-id',
      createdAt: new Date(),
      updatedAt: new Date(),
      email: 'test@test.com',
      username: 'testuser',
      passwordHash: null,
      globalRole: GlobalRole.USER,
      isActive: true,
      isBanned: false,
      penaltyPoints: 0,
      preferredLanguage: 'en',
      ...overrides,
    };
    return { ...defaultUser, ...overrides };
  };

  describe('sendFriendRequest', () => {
    it('should throw BadRequest if user targets themselves', async () => {
      await expect(
        service.sendFriendRequest('user-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequest if a block exists', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(mockUser as any);
      prismaMock.user.findUnique.mockResolvedValueOnce(mockTarget as any);

      // Mock finding an existing block
      prismaMock.block.findFirst.mockResolvedValue({
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
      prismaMock.user.findUnique.mockResolvedValueOnce(mockUser as any);
      prismaMock.user.findUnique.mockResolvedValueOnce(mockTarget as any);
      prismaMock.block.findFirst.mockResolvedValue(null);
      prismaMock.friendship.findFirst.mockResolvedValue(null);

      const mockFriendship = {
        id: 'f-1',
        requesterId: 'user-1',
        addresseeId: 'user-2',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prismaMock.friendship.create.mockResolvedValue(mockFriendship as any);

      const result = await service.sendFriendRequest('user-1', 'user-2');

      expect(result['message']).toBe('friend request sent');
      expect(prismaMock.friendship.create).toHaveBeenCalled();
      expect(notificationsService['createFromInput']).toHaveBeenCalled();
      expect(gateway['emitNotificationCreated']).toHaveBeenCalledWith(
        'user-2',
        expect.anything(),
      );
    });
  });

  describe('acceptFriendRequest', () => {
    it('should throw NotFound if no pending request exists', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser as any);
      prismaMock.block.findFirst.mockResolvedValue(null);
      prismaMock.friendship.findFirst.mockResolvedValue(null);

      await expect(
        service.acceptFriendRequest('user-1', 'user-2'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('blockUser', () => {
    it('should create a block and delete existing friendship in a transaction', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(mockUser as any);
      prismaMock.user.findUnique.mockResolvedValueOnce(mockTarget as any);

      prismaMock.block.findUnique.mockResolvedValue(null); // No existing block
      prismaMock.friendship.findFirst.mockResolvedValue({
        id: 'f-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        requesterId: '',
        addresseeId: '',
        status: 'PENDING',
      }); // Existing friendship

      const mockBlock = { id: 'b-1', blockerId: 'user-1', blockedId: 'user-2' };
      prismaMock.block.create.mockResolvedValue(mockBlock as any);

      const result = await service.blockUser('user-1', 'user-2');

      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(prismaMock.friendship.delete).toHaveBeenCalledWith({
        where: { id: 'f-1' },
      });
      expect(result.friendshipRemoved).toBe(true);
    });
  });

  
});
