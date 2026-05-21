import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service'; // Adjust path if needed
import { AutoModerationService } from '../moderation/auto-moderation.service'; // Adjust path if needed
import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

describe('ChatService', () => {
  let service: ChatService;
  let prisma: PrismaService;

  beforeEach(async () => {
    // We create a mock module that acts like a mini-version of your app
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: PrismaService,
          useValue: {
            // Mock the methods you use from Prisma (e.g., findMany, create)
            user: {
              findMany: jest.fn(),
            },
            block: {
              findFirst: jest.fn(),
            },
            conversation: {
              findFirst: jest.fn(),
              create: jest.fn(),
            },
            message: {
              findMany: jest.fn(),
              create: jest.fn(),
            },
            conversationParticipant: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: AutoModerationService,
          useValue: {
            // Mock the methods from your moderation service
            moderateText: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('createOrGetDirectConversation', () => {
    const actorId = 'user-1';
    const targetId = 'user-2';
    const mockConversation = {
      id: 'conv-id',
      type: 'DIRECT',
      participants: [],
    };

    beforeEach(() => {
      // We mock the validation method to always pass (resolve)
      // We cast to any if the method is private
      jest
        .spyOn(service as any, 'ensureCanDirectMessage')
        .mockResolvedValue(undefined);
    });

    it('Scenario 1: should return existing conversation if found', async () => {
      // 1. Arrange: findFirst returns a conversation
      jest
        .spyOn(prisma.conversation, 'findFirst')
        .mockResolvedValue(mockConversation as any);
      const createSpy = jest.spyOn(prisma.conversation, 'create');

      // 2. Act
      const result = await service.createOrGetDirectConversation(
        actorId,
        targetId,
      );

      // 3. Assert
      expect(result).toEqual(mockConversation);
      expect(prisma.conversation.findFirst).toHaveBeenCalled();
      // CRITICAL: Ensure create was NOT called because it already existed
      expect(createSpy).not.toHaveBeenCalled();
    });

    it('Scenario 2: should create a new conversation if none exists', async () => {
      // 1. Arrange: findFirst returns null, create returns a new conv
      jest.spyOn(prisma.conversation, 'findFirst').mockResolvedValue(null);
      jest
        .spyOn(prisma.conversation, 'create')
        .mockResolvedValue(mockConversation as any);

      // 2. Act
      const result = await service.createOrGetDirectConversation(
        actorId,
        targetId,
      );

      // 3. Assert
      expect(result).toEqual(mockConversation);
      expect(prisma.conversation.findFirst).toHaveBeenCalled();
      expect(prisma.conversation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'DIRECT',
            participants: expect.anything(),
          }),
        }),
      );
    });

    it('Scenario 3: should throw if validation fails', async () => {
      // 1. Arrange: Mock the validation to FAIL
      jest.spyOn(service as any, 'ensureCanDirectMessage')
        .mockRejectedValue(new ForbiddenException('Blocked'));

      // 2. Act & Assert
      await expect(
        service.createOrGetDirectConversation(actorId, targetId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('ensureConversationMembership', () => {
    const conversationId = 'conv-123';
    const userId = 'User1';

    it('scenario 1: should return a forbiddenExeception if user is not part of the conversation', async () => {
      jest.spyOn(prisma.conversationParticipant, 'findFirst')
        .mockResolvedValue(null);
      await expect(
        service.ensureConversationMembership(userId, conversationId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('scenario 2: should return membership as user part of the conversation', async () => {
      const mockUser = {
        conversationId: 'conv-123',
        userId: 'User1',
      }
      jest.spyOn(prisma.conversationParticipant, 'findFirst')
        .mockResolvedValue(mockUser as any);

      const result = await service.ensureConversationMembership(
        mockUser.userId,
        mockUser.conversationId,
      );

      expect(result).toEqual(mockUser);
    });
  });

  describe('getOtherParticipantIds', () => {
    const conversationId = 'conv-123';
    const currentUserId = 'user-current';
    const otherUserId = 'user-other';

    it('scenario 1: should return other participant IDs, excluding the current user', async () => {
      const mockParticipants = [
        { userId: currentUserId },
        { userId: otherUserId },
      ];

      jest.spyOn(prisma.conversationParticipant, 'findMany')
        .mockResolvedValue(mockParticipants as any);

      // Act
      const result = await service.getOtherParticipantIds(
        conversationId,
        currentUserId,
      );

      // Assert
      // 1. It successfully mapped and filtered the array to only contain the other user
      expect(result).toEqual([otherUserId]);
      expect(result).not.toContain(currentUserId);

      // 2. It queried the database with the correct 'where' and 'select' filters
      expect(prisma.conversationParticipant.findMany).toHaveBeenCalledWith({
        where: { conversationId },
        select: { userId: true },
      });
    });

    it('scenario 2: should return an empty array if the current user is the only participant', async () => {
      // Arrange: Only the current user is in the room
      const mockParticipants = [{ userId: currentUserId }];

      jest.spyOn(prisma.conversationParticipant, 'findMany')
        .mockResolvedValue(mockParticipants as any);

      // Act
      const result = await service.getOtherParticipantIds(
        conversationId,
        currentUserId,
      );

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('ensureCanInviteToConversation', () => {
    const actorUserId = 'Actor-1';
    const conversationId = 'convX';

    it('Scenario 1: should throw forbiddenException if not participant', async () => {
      jest
        .spyOn(prisma.conversationParticipant, 'findUnique')
        .mockResolvedValue(null);

      await expect(
        service.ensureCanInviteToConversation(actorUserId, conversationId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Scenario 2: should throw BadRequestException if it is a DIRECT conversation', async () => {
      // We mock a membership that DOES exist, but the attached conversation is 'DIRECT'
      const mockMembership = {
        userId: 'Actor-2',
        conversationId: 'convX',
        conversation: {
          type: 'DIRECT', // This will trigger the second IF
        },
      };

      jest.spyOn(prisma.conversationParticipant, 'findUnique')
        .mockResolvedValue(mockMembership as any);

      await expect(
        service.ensureCanInviteToConversation('Actor-1', 'convX'),
      ).rejects.toThrow(BadRequestException);
    });

    it('Scenario 3: user can be invited to conversation', async () => {
      const mockMembership2 = {
        userId: 'Actor-3',
        conversationId: 'convX',
        conversation: {
          type: 'GROUP', // This will trigger the second IF
        },
      };

      jest.spyOn(prisma.conversationParticipant, 'findUnique')
        .mockResolvedValue(mockMembership2 as any);

      const result = await service.ensureCanInviteToConversation(
        mockMembership2.userId,
        mockMembership2.conversationId,
      );

      expect(result).toEqual(mockMembership2);
    });
  });

  describe('ensureUsersCanBeAdded', () => {
    const actorUserId = 'Actor-1';
    const targetUserIds = ['targetUserIds-1'];

    it('Scenario 1: should throw BadRequestException if user to add does not exist', async () => {
      // 4. Mock findMany to return an empty array (0 length)
      // Since targetUserIds.length is 1, this triggers the (0 !== 1) error
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue([]);

      // Act & Assert: Check if it throws the right error
      await expect(
        service.ensureUsersCanBeAdded(actorUserId, targetUserIds),
      ).rejects.toThrow(BadRequestException);
    });

    it('Scenario 2-1: should throw BadRequestException if user to add is not active or banned', async () => {
      // Setup: user exists and is active
      const actorUserId = 'actor-2';
      const targetUserIds = ['target-2']; // FIX: Must be an array
      const mockUser = {
        id: 'target-2',
        username: 'inactive',
        isActive: false,
        isBanned: false,
      };
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue([mockUser] as any);

      // Act & Assert: Check if it throws the right error
      await expect(
        service.ensureUsersCanBeAdded(actorUserId, targetUserIds),
      ).rejects.toThrow(BadRequestException);
    });

    it('Scenario 2-2: should throw BadRequestException if user to add is banned', async () => {
      // Setup: user exists and is active
      const actorUserId = 'actor-2-2';
      const targetUserIds = ['target-2-2']; // FIX: Must be an array
      const mockUser = {
        id: 'target-2-2',
        username: 'banned',
        isActive: true,
        isBanned: true,
      };
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue([mockUser] as any);

      // Act & Assert: Check if it throws the right error
      await expect(
        service.ensureUsersCanBeAdded(actorUserId, targetUserIds),
      ).rejects.toThrow(BadRequestException);
    });

    it('Scenario 3: should throw ForbiddenException if a block exists', async () => {
      // Setup: user exists and is active
      const actorUserId = 'actor-3';
      const targetUserIds = ['target-3']; // FIX: Must be an array
      const mockUser = {
        id: 'target-3',
        username: 'victim',
        isActive: true,
        isBanned: false,
      };
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue([mockUser] as any);

      // Setup: but a block is found
      jest
        .spyOn(prisma.block, 'findFirst')
        .mockResolvedValue({ id: 'block-id' } as any);

      await expect(
        service.ensureUsersCanBeAdded(actorUserId, targetUserIds),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Scenario 4: should return users if no blocks exist', async () => {
      const actorUserId = 'actor-4';
      const targetUserIds = ['target-4'];
      const mockUsers = [
        { id: 'target-4', username: 'victim', isActive: true, isBanned: false },
      ];

      // 1. Mock users found
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue(mockUsers as any);

      // 2. Mock NO block found (Return null!)
      jest.spyOn(prisma.block, 'findFirst').mockResolvedValue(null);

      // 3. Act
      const result = await service.ensureUsersCanBeAdded(
        actorUserId,
        targetUserIds,
      );

      // 4. Assert
      expect(result).toEqual(mockUsers); // Should return the users, not throw an error
    });
  });
});
