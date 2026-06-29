import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service'; // Adjust path if needed
import { AutoModerationService } from '../moderation/auto-moderation.service'; // Adjust path if needed
import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('ChatService', () => {
  let service: ChatService;
  let prisma: PrismaService;
  let autoModerationService: AutoModerationService;
  // These represent the 'tx' client inside the transaction
  let mockTick: any;
  // These represent 'this.prisma' outside the transaction
  let mockPrisma: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    // 1. Define what the 'tx' (transaction client) looks like for callbacks
    mockTick = {
      conversationParticipant: {
        delete: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
      },
      conversation: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        createMany: jest.fn(),
        update: jest.fn(),
      },
      message: { create: jest.fn() },
      user: { update: jest.fn() },
      messageRead: { createMany: jest.fn() }, // For transactions
    };
    const mockClient = {
      $transaction: jest.fn((input: any) => {
        if (typeof input === 'function')
          return Promise.resolve(input(mockTick)) as Promise<unknown>;
        return Promise.all(input) as Promise<unknown>;
      }),
      conversation: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      conversationParticipant: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        createMany: jest.fn(),
        delete: jest.fn(),
      },
      user: { findUnique: jest.fn(), findMany: jest.fn() },
      block: { findFirst: jest.fn() },
      message: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      messageReaction: { findUnique: jest.fn(), create: jest.fn() },
      messageRead: { createMany: jest.fn() },
    };

    mockPrisma = {
      client: mockClient, // The Service now WRAPS the client
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: AutoModerationService,
          useValue: { moderateText: jest.fn() },
        },
        {
          provide: AutoModerationService,
          useValue: {
            // Mock the methods from your moderation service
            moderateText: jest.fn(),
            analyze: jest.fn(),
            applyBlockedMessage: jest.fn(),
            applyFlaggedMessage: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    prisma = module.get<PrismaService>(PrismaService);
    autoModerationService = module.get<AutoModerationService>(
      AutoModerationService,
    );
  });

  describe('markConversationRead', () => {
    const userId = 'user-1';
    const convId = 'conv-1';

    beforeEach(() => {
      jest
        .spyOn(service as any, 'ensureLiveSender')
        .mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'ensureConversationMembership')
        .mockResolvedValue(undefined);
    });

    it('Scenario 1: should mark messages as read', async () => {
      jest
        .spyOn(prisma.client.message, 'findMany')
        .mockResolvedValue([{ id: 'm1' }] as any);

      // This will now work because prisma.messageRead is defined in beforeEach
      jest
        .spyOn(prisma.client.messageRead, 'createMany')
        .mockResolvedValue({ count: 1 });

      const result = await service.markConversationRead(userId, convId);
      expect(result.readCount).toBe(1);
    });

    it('Scenario 2: should return 0 if no messages are found to read', async () => {
      jest.spyOn(prisma.client.message, 'findMany').mockResolvedValue([]);
      const result = await service.markConversationRead(userId, convId);
      expect(result.readCount).toBe(0);
    });
  });

  describe('sendMessage', () => {
    const userId = 'user-1';
    const convId = 'conv-1';
    const sender = { id: userId, username: 'marvin' };

    beforeEach(() => {
      jest.spyOn(service as any, 'ensureLiveSender').mockResolvedValue(sender);
      jest
        .spyOn(service as any, 'ensureConversationMembership')
        .mockResolvedValue(undefined);
    });

    it('Scenario 1: should return BadRequestException', async () => {
      const contentEmpty = ' ';

      await expect(
        service.sendMessage(userId, convId, contentEmpty),
      ).rejects.toThrow(new BadRequestException('message content is empty'));
      // Verification: Ensure the AI moderation and Prisma were NEVER called
      expect(autoModerationService.analyze).not.toHaveBeenCalled();
      expect(prisma.client.message.create).not.toHaveBeenCalled();
    });

    it('Scenario 2: Successful clean message', async () => {
      const content = 'Hello world';
      // Mock AI: Allow the message
      jest
        .spyOn(autoModerationService, 'analyze')
        .mockResolvedValue({ action: 'ALLOW' } as any);
      jest
        .spyOn(prisma.client.message, 'create')
        .mockResolvedValue({ id: 'm1', content } as any);
      jest
        .spyOn(prisma.client.conversation, 'update')
        .mockResolvedValue({} as any);

      const result = await service.sendMessage(userId, convId, content);
      expect(result.content).toBe(content);
    });

    it('Scenario 3: Moderation BLOCK (Bad content)', async () => {
      // 1. Mock AI: BLOCK the message
      jest.spyOn(autoModerationService, 'analyze').mockResolvedValue({
        action: 'BLOCK',
        severity: 'HIGH',
        categories: ['Hate'],
        penaltyPointsToSubtract: 100,
      } as any);

      jest
        .spyOn(autoModerationService, 'applyBlockedMessage')
        .mockResolvedValue({
          penalty: {
            isBanned: false,
            penaltyPoints: 100,
            pointsLeftBeforeBan: 400,
          },
        } as any);

      jest
        .spyOn(prisma.client.message, 'create')
        .mockResolvedValue({ id: 'sys-1', content: 'placeholder' } as any);
      jest
        .spyOn(prisma.client.conversation, 'update')
        .mockResolvedValue({} as any);

      const result = (await service.sendMessage(
        userId,
        convId,
        'bad word',
      )) as any;
      expect(result.moderationWarning.message).toContain('deleted');
    });

    it('Scenario 4: Moderation REPORT + Automatic BAN', async () => {
      const content = 'Slightly toxic message';

      // 1. Mock AI: Action is REPORT
      jest.spyOn(autoModerationService, 'analyze').mockResolvedValue({
        action: 'REPORT',
        severity: 'MEDIUM',
        categories: ['Spam'],
        penaltyPointsToSubtract: 50,
      } as any);

      // 2. Mock: Flagging the message results in a BAN
      jest
        .spyOn(autoModerationService, 'applyFlaggedMessage')
        .mockResolvedValue({
          penalty: {
            isBanned: true, // This triggers the red lines!
            penaltyPoints: 500,
            pointsLeftBeforeBan: 0,
          },
        } as any);

      // 3. Mock Prisma calls
      // First create: the user's message
      // Second create: the ban announcement
      jest
        .spyOn(prisma.client.message, 'create')
        .mockResolvedValueOnce({ id: 'user-msg', content } as any)
        .mockResolvedValueOnce({
          id: 'ban-announcement',
          type: 'SYSTEM',
        } as any);

      jest
        .spyOn(prisma.client.conversation, 'update')
        .mockResolvedValue({} as any);

      // 4. Act
      const result = (await service.sendMessage(
        userId,
        convId,
        content,
      )) as any;

      // 5. Assert
      expect(result.moderationWarning.message).toContain('flagged');
      expect(result.banAnnouncementMessage).not.toBeNull();
      expect(prisma.client.message.create).toHaveBeenCalledTimes(2); // One for text, one for system announcement
      expect(prisma.client.conversation.update).toHaveBeenCalled();
    });

    it('Scenario 5: should reject an orphaned direct conversation', async () => {
      jest
        .spyOn(prisma.client.conversation, 'findUnique')
        .mockResolvedValue({ type: 'DIRECT' } as any);
      jest
        .spyOn(prisma.client.conversationParticipant, 'findMany')
        .mockResolvedValue([{ userId }] as any);

      await expect(
        service.sendMessage(userId, convId, 'hello'),
      ).rejects.toThrow(
        new BadRequestException('direct conversation is no longer available'),
      );
      expect(autoModerationService.analyze).not.toHaveBeenCalled();
    });
  });

  describe('addMessageReaction', () => {
    const userId = 'reactor-id';
    const senderId = 'sender-id';
    const msgId = 'msg-1';
    const convId = 'conv-1';

    beforeEach(() => {
      jest
        .spyOn(service as any, 'ensureLiveSender')
        .mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'ensureConversationMembership')
        .mockResolvedValue(undefined);
    });

    it('Scenario 1: should throw BadRequest if user reacts to their own message', async () => {
      jest.spyOn(prisma.client.message, 'findUnique').mockResolvedValue({
        senderId: userId, // Same as actor
        conversationId: convId,
      } as any);

      await expect(
        service.addMessageReaction(userId, convId, msgId, 'HEART'),
      ).rejects.toThrow(
        new BadRequestException('you cannot react to your own message'),
      );
    });

    it('Scenario 2: should return early if reaction already exists', async () => {
      jest.spyOn(prisma.client.message, 'findUnique').mockResolvedValue({
        senderId: senderId,
        conversationId: convId,
      } as any);

      // Mock existing reaction in the transaction
      const tx = {
        messageReaction: {
          // We define the implementation directly. This forces the return type to NOT be never.
          findUnique: jest
            .fn()
            .mockImplementation(async () =>
              Promise.resolve({ id: 'existing' }),
            ),
        },
      } as any;

      jest
        .spyOn(prisma.client, '$transaction')
        // Tell TS the callback returns a Promise to satisfy the unsafe-return rule
        .mockImplementation(async (cb: (arg: any) => Promise<any>) => {
          const result = await cb(tx);
          return result as unknown;
        });

      const result = await service.addMessageReaction(
        userId,
        convId,
        msgId,
        'THUMBS_UP',
      );
      expect(result.pointsAwarded).toBe(0);
    });

    it('Scenario 3: should promote sender to MODERATOR if points reach 500', async () => {
      const mockSender = {
        id: senderId,
        penaltyPoints: 495,
        globalRole: 'USER',
        isActive: true,
        isBanned: false,
      };
      jest.spyOn(prisma.client.message, 'findUnique').mockResolvedValue({
        senderId,
        conversationId: convId,
        sender: mockSender,
      } as any);

      const tx = {
        messageReaction: {
          findUnique: jest.fn().mockImplementation(() => Promise.resolve(null)),
          create: jest.fn().mockImplementation(() => Promise.resolve({})),
        },
        user: {
          update: jest
            .fn()
            .mockImplementationOnce(() =>
              Promise.resolve({ ...mockSender, penaltyPoints: 500 }),
            )
            .mockImplementationOnce(() =>
              Promise.resolve({
                ...mockSender,
                penaltyPoints: 500,
                globalRole: 'MODERATOR',
              }),
            ),
        },
      } as any;

      jest
        .spyOn(prisma.client, '$transaction')
        .mockImplementation(async (cb: (arg: any) => Promise<any>) => {
          const result = await cb(tx);
          return result as unknown;
        });

      const result = await service.addMessageReaction(
        userId,
        convId,
        msgId,
        'THUMBS_UP',
      );

      expect(result.senderPromoted).toBe(true);
      expect(result.sender.globalRole).toBe('MODERATOR');
      expect(tx.user.update).toHaveBeenCalledTimes(2); // One for points, one for role
    });
  });

  describe('deleteMessage', () => {
    const userId = 'user-1';
    const convId = 'conv-1';
    const msgId = 'msg-1';

    beforeEach(() => {
      jest
        .spyOn(service as any, 'ensureLiveSender')
        .mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'ensureConversationMembership')
        .mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'ensureLastMessage')
        .mockResolvedValue(undefined);
    });

    it('Scenario 1: should throw Forbidden if trying to delete someone else message', async () => {
      jest.spyOn(prisma.client.message, 'findUnique').mockResolvedValue({
        senderId: 'other-user',
        conversationId: convId,
      } as any);

      await expect(
        service.deleteMessage(userId, convId, msgId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Scenario 2: should successfully soft-delete the message', async () => {
      jest.spyOn(prisma.client.message, 'findUnique').mockResolvedValue({
        senderId: userId,
        conversationId: convId,
        deletedAt: null,
      } as any);

      const updateSpy = jest
        .spyOn(prisma.client.message, 'update')
        .mockResolvedValue({} as any);

      await service.deleteMessage(userId, convId, msgId);

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { content: null, deletedAt: expect.any(Date) },
        }),
      );
    });
  });

  describe('editMessage', () => {
    const userId = 'user-123';
    const conversationId = 'conv-456';
    const messageId = 'msg-789';
    const validContent = 'This is the new content';

    beforeEach(() => {
      // 1. Mock standard validations
      jest
        .spyOn(service as any, 'ensureLiveSender')
        .mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'ensureConversationMembership')
        .mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'ensureLastMessage')
        .mockResolvedValue(undefined);
    });

    it('Scenario 1: should throw NotFound if message does not exist or belongs to other conv', async () => {
      // Mock: Message not found
      jest.spyOn(prisma.client.message, 'findUnique').mockResolvedValue(null);

      await expect(
        service.editMessage(userId, conversationId, messageId, validContent),
      ).rejects.toThrow(NotFoundException);
    });

    it('Scenario 2: should throw Forbidden if user is not the sender', async () => {
      // Mock: Message exists but senderId is different
      jest.spyOn(prisma.client.message, 'findUnique').mockResolvedValue({
        id: messageId,
        conversationId: conversationId,
        senderId: 'someone-else',
        deletedAt: null,
      } as any);

      await expect(
        service.editMessage(userId, conversationId, messageId, validContent),
      ).rejects.toThrow(
        new ForbiddenException('you can only edit your own messages'),
      );
    });

    it('Scenario 3: should throw BadRequest if message was already deleted', async () => {
      // Mock: Message has a deletedAt timestamp
      jest.spyOn(prisma.client.message, 'findUnique').mockResolvedValue({
        id: messageId,
        conversationId: conversationId,
        senderId: userId,
        deletedAt: new Date(),
      } as any);

      await expect(
        service.editMessage(userId, conversationId, messageId, validContent),
      ).rejects.toThrow(
        new BadRequestException('deleted messages cannot be edited'),
      );
    });

    it('Scenario 4: should throw BadRequest if new content is empty after trim', async () => {
      // Mock: Valid message state
      jest.spyOn(prisma.client.message, 'findUnique').mockResolvedValue({
        id: messageId,
        conversationId: conversationId,
        senderId: userId,
        deletedAt: null,
      } as any);

      await expect(
        service.editMessage(userId, conversationId, messageId, '    '), // Empty spaces
      ).rejects.toThrow(new BadRequestException('message content is empty'));
    });

    it('Scenario 5: should successfully update the message', async () => {
      const mockUpdatedMessage = {
        id: messageId,
        content: 'Clean content',
        isEdited: true,
      };

      jest.spyOn(prisma.client.message, 'findUnique').mockResolvedValue({
        id: messageId,
        conversationId: conversationId,
        senderId: userId,
        deletedAt: null,
      } as any);

      jest
        .spyOn(prisma.client.message, 'update')
        .mockResolvedValue(mockUpdatedMessage as any);

      const result = await service.editMessage(
        userId,
        conversationId,
        messageId,
        '  Clean content  ',
      );

      expect(result.content).toBe('Clean content');
      expect(result.isEdited).toBe(true);

      // Verify Prisma was called with the trimmed content
      expect(prisma.client.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { content: 'Clean content', isEdited: true },
        }),
      );
    });
  });

  describe('listMembers', () => {
    const userId = 'user1';
    const conversationId = 'conv-123';

    beforeEach(() => {
      // 1. Mock internal validations to always pass
      jest
        .spyOn(service as any, 'ensureConversationMembership')
        .mockResolvedValue({
          conversationId,
          userId,
        });
    });
    it('Scenario 1: should format a member list correctly', async () => {
      const mockDbResult = [
        {
          id: 'part-1',
          userId: 'user-1',
          role: 'OWNER',
          joinedAt: new Date(),
          user: {
            // Single object, NOT an array
            id: 'user-1',
            username: 'marvin',
            profile: { displayName: 'Marvin the Robot', avatarUrl: 'img1.png' },
          },
        },
        {
          id: 'part-2',
          userId: 'user-2',
          role: 'MEMBER',
          joinedAt: new Date(),
          user: {
            id: 'user-2',
            username: 'arthur',
            profile: null, // Test the fallback logic too!
          },
        },
      ];

      jest
        .spyOn(prisma.client.conversationParticipant, 'findMany')
        .mockResolvedValue(mockDbResult as any);

      const result = await service.listMembers(userId, conversationId);

      // Check the first user (marvin)
      expect(result[0].user.username).toBe('marvin');
      expect(result[0].user.displayName).toBe('Marvin the Robot');

      // Check the second user fallback logic (arthur)
      expect(result[1].user.username).toBe('arthur');
      expect(result[1].user.displayName).toBe('arthur'); // Should fallback to username
    });
  });

  describe('listMessages', () => {
    const conversationId = 'conv-123';
    const userId = 'User1';
    beforeEach(() => {
      // 1. Mock internal validations to always pass
      jest
        .spyOn(service as any, 'ensureConversationMembership')
        .mockResolvedValue({
          conversationId,
          userId,
          joinedAt: new Date('2026-01-01'),
        });
    });
    it('Scenario 1: should list up to 100 messages with sender, reads, and reactions', async () => {
      // 1. Arrange: Create a mock result that matches your Prisma "include" structure
      const mockMessages = [
        {
          id: 'msg-1',
          content: 'Hello world',
          createdAt: new Date(),
          sender: { username: 'User1', profile: { avatarUrl: 'url1' } },
          reads: [{ readAt: new Date(), user: { username: 'User2' } }],
          reactions: [{ content: '👍', user: { username: 'User2' } }],
        },
      ];

      jest
        .spyOn(prisma.client.message, 'findMany')
        .mockResolvedValue(mockMessages as any);

      // 2. Act
      const result = await service.listMessages(userId, conversationId);

      // 3. Assert
      expect(result).toEqual(mockMessages);
      expect(result.length).toBe(1);

      // 4. Verify Prisma Call: Ensure we are fetching the right data
      // Fix the verification part in your listMessages test:
      expect(prisma.client.message.findMany).toHaveBeenCalledWith({
        where: {
          conversationId,
          createdAt: { gte: new Date('2026-01-01') },
        },
        select: expect.objectContaining({
          sender: {
            select: expect.objectContaining({
              id: true,
              username: true,
              profile: expect.anything(),
            }),
          },
          reads: expect.anything(),
          reactions: expect.anything(),
        }),
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      const query = jest.mocked(prisma.client.message.findMany).mock
        .calls[0][0];
      expect(JSON.stringify(query)).not.toContain('passwordHash');
      expect(JSON.stringify(query)).not.toContain('"email"');
      expect(JSON.stringify(query)).not.toContain('globalRole');
    });

    it('Scenario 2: should throw ForbiddenException if user is not a member (Security check)', async () => {
      // Override the beforeEach mock to simulate a permission failure
      jest
        .spyOn(service as any, 'ensureConversationMembership')
        .mockRejectedValue(new ForbiddenException('you are not a participant'));

      await expect(
        service.listMessages(userId, conversationId),
      ).rejects.toThrow(ForbiddenException);

      // Ensure the database is NEVER queried if permission is denied
      expect(prisma.client.message.findMany).not.toHaveBeenCalled();
    });
  });

  describe('listMyConversations', () => {
    it('Scenario 1: should format a DIRECT conversation correctly', async () => {
      const mockDbResult = [
        {
          id: '1',
          type: 'DIRECT',
          participants: [
            {
              userId: 'me',
              joinedAt: new Date('2026-01-01'),
              user: { username: 'me' },
            },
            {
              userId: 'other',
              user: { username: 'Yann', profile: { avatarUrl: 'img.png' } },
            },
          ],
          messages: [{ content: 'Hi!', createdAt: new Date('2026-02-01') }],
        },
      ];

      jest
        .spyOn(prisma.client.conversation, 'findMany')
        .mockResolvedValue(mockDbResult as any);

      const result = await service.listMyConversations('me');

      expect(result[0].name).toBe('Yann'); // Correctly picked the other user
      expect(result[0].type).toBe('dm');
      expect(result[0].lastMessage).toBe('Hi!');
    });

    it('Scenario 2: should format a GROUP conversation correctly', async () => {
      const mockDbResult = [
        {
          id: '1',
          type: 'GROUP',
          participants: [
            {
              userId: 'me',
              joinedAt: new Date('2026-01-01'),
              user: { username: 'me' },
            },
            {
              userId: 'other',
              user: { username: 'Yann', profile: { avatarUrl: 'img.png' } },
            },
          ],
          messages: [{ content: 'Hi!', createdAt: new Date('2026-02-01') }],
        },
      ];

      jest
        .spyOn(prisma.client.conversation, 'findMany')
        .mockResolvedValue(mockDbResult as any);

      const result = await service.listMyConversations('me');

      expect(result[0].name).toBe('Group chat'); // Correctly picked the other user
      expect(result[0].type).toBe('group');
      expect(result[0].lastMessage).toBe('Hi!');
    });

    it('Scenario 3: should hide orphaned conversations after a participant was erased', async () => {
      const mockDbResult = [
        {
          id: 'orphan-direct',
          type: 'DIRECT',
          participants: [
            {
              userId: 'me',
              leftAt: null,
              joinedAt: new Date('2026-01-01'),
              user: { username: 'me' },
            },
          ],
          messages: [],
        },
        {
          id: 'orphan-group',
          type: 'GROUP',
          title: 'Old group',
          participants: [
            {
              userId: 'me',
              leftAt: null,
              joinedAt: new Date('2026-01-01'),
              user: { username: 'me' },
            },
          ],
          messages: [],
        },
        {
          id: 'valid-direct',
          type: 'DIRECT',
          participants: [
            {
              userId: 'me',
              leftAt: null,
              joinedAt: new Date('2026-01-01'),
              user: { username: 'me' },
            },
            {
              userId: 'other',
              leftAt: null,
              joinedAt: new Date('2026-01-01'),
              user: { username: 'Yann', profile: { avatarUrl: null } },
            },
          ],
          messages: [],
        },
      ];

      jest
        .spyOn(prisma.client.conversation, 'findMany')
        .mockResolvedValue(mockDbResult as any);

      const result = await service.listMyConversations('me');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('valid-direct');
    });
  });

  describe('renameConversation', () => {
    const actorUserId = 'renamer-id';
    const conversationId = 'conv-123';
    beforeEach(() => {
      // 1. Mock internal validations to always pass
      jest
        .spyOn(service as any, 'ensureLiveSender')
        .mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'ensureGroupManagementPermission')
        .mockResolvedValue({
          id: conversationId,
        });
    });

    it('Scenario 1: should throw BadRequestException when no title entered', async () => {
      const titleConvFail = ' ';

      await expect(
        service.renameConversation(actorUserId, conversationId, titleConvFail),
      ).rejects.toThrow(
        new BadRequestException('conversation title cannot be empty'),
      );
    });

    it('Scenario 2: should pass successfully', async () => {
      const titleConvPass = 'Title is OK ';
      const expectedTrimmedTitle = 'Title is OK';

      const mockUpdatedConv = {
        id: conversationId,
        title: expectedTrimmedTitle,
      };
      jest
        .spyOn(prisma.client.conversation, 'update')
        .mockResolvedValue(mockUpdatedConv as any);

      // 3. Act
      const result = await service.renameConversation(
        actorUserId,
        conversationId,
        titleConvPass,
      );

      // 4. Assert
      expect(result.message).toBe('conversation renamed successfully');
      expect(result.conversation.title).toBe(expectedTrimmedTitle);

      // 5. Critical Verification: Was the DB called with the TRIMMED title?
      expect(prisma.client.conversation.update).toHaveBeenCalledWith({
        where: { id: conversationId },
        data: expect.objectContaining({
          title: expectedTrimmedTitle,
        }),
      });
    });

    it('Scenario 3: should throw if user has no management permission', async () => {
      // Mocking the permission check to FAIL
      jest
        .spyOn(service as any, 'ensureGroupManagementPermission')
        .mockRejectedValue(new ForbiddenException('No permission'));

      await expect(
        service.renameConversation(actorUserId, conversationId, 'Valid Title'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('leaveConversation', () => {
    const userId = 'leaver-id';
    const otherUserId = 'senior-member-id';
    const convId = 'group-123';

    beforeEach(() => {
      jest
        .spyOn(service as any, 'ensureLiveSender')
        .mockResolvedValue(undefined);
    });
    // Scenario 1: Not a participant
    // Mock findUnique to return null. (Throws ForbiddenException).
    it('Scenario 1: should throw ForbiddenException when no participant into conversation', async () => {
      jest
        .spyOn(prisma.client.conversationParticipant, 'findUnique')
        .mockResolvedValue(null);

      await expect(
        service.removeUserFromGroup('  ', convId, '   '),
      ).rejects.toThrow(ForbiddenException);
    });
    // Scenario 2: Not a GROUP
    // Mock findUnique to return a membership where conversation.type = 'DIRECT'. (Throws BadRequestException).
    it('Scenario 2: should throw BadRequest if leaver is leaving a direct conversation', async () => {
      jest
        .spyOn(prisma.client.conversationParticipant, 'findUnique')
        .mockResolvedValue({
          role: 'MEMBER',
          conversation: { type: 'DIRECT' },
        } as any);
      jest
        .spyOn(prisma.client.conversationParticipant, 'findMany')
        .mockResolvedValue([{ userId, otherUserId }] as any);

      await expect(service.leaveConversation(userId, convId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('Scenario 3: should throw BadRequest if leaver is the last participant', async () => {
      jest
        .spyOn(prisma.client.conversationParticipant, 'findUnique')
        .mockResolvedValue({
          role: 'MEMBER',
          conversation: { type: 'GROUP' },
        } as any);

      // Only 1 person in the list
      jest
        .spyOn(prisma.client.conversationParticipant, 'findMany')
        .mockResolvedValue([{ userId }] as any);

      await expect(service.leaveConversation(userId, convId)).rejects.toThrow(
        new BadRequestException('Cannot leave the last participant'),
      );
    });

    it('Scenario 4: should allow a MEMBER to leave without transferring ownership', async () => {
      jest
        .spyOn(prisma.client.conversationParticipant, 'findUnique')
        .mockResolvedValue({
          role: 'MEMBER',
          conversation: { type: 'GROUP', title: 'Test Room' },
        } as any);

      jest
        .spyOn(prisma.client.conversationParticipant, 'findMany')
        .mockResolvedValue([
          { userId: 'owner-id', joinedAt: new Date(100) },
          { userId, joinedAt: new Date(200) },
        ] as any);

      const result = await service.leaveConversation(userId, convId);

      expect(result.previousRole).toBe('MEMBER');
      expect(result.nextOwnerId).toBeNull();
      expect(result.message).toBe('left conversation successfully');
    });

    it('Scenario 5: should transfer ownership to the oldest member when OWNER leaves', async () => {
      // 1. Leaver is the OWNER
      jest
        .spyOn(prisma.client.conversationParticipant, 'findUnique')
        .mockResolvedValue({
          role: 'OWNER',
          conversation: { type: 'GROUP', title: 'Owner Room' },
        } as any);

      // 2. Participants list (ordered by joinedAt)
      // index 0 is owner (leaving), index 1 is the oldest remaining
      const mockParticipants = [
        { userId, joinedAt: new Date(100) },
        { userId: otherUserId, joinedAt: new Date(200) },
        { userId: 'newbie-id', joinedAt: new Date(300) },
      ];
      jest
        .spyOn(prisma.client.conversationParticipant, 'findMany')
        .mockResolvedValue(mockParticipants as any);

      const result = await service.leaveConversation(userId, convId);

      // 3. Assertions
      expect(result.previousRole).toBe('OWNER');
      expect(result.nextOwnerId).toBe(otherUserId); // The senior member
      expect(result.remainingUserIds).toContain(otherUserId);
      expect(result.remainingUserIds).not.toContain(userId);

      // Check if transaction was called (Logic verification)
      expect(prisma.client.$transaction).toHaveBeenCalled();
    });
  });

  describe('removeUserFromGroup', () => {
    const actorId = 'actor-admin';
    const targetId = 'target-user';
    const convId = 'conv-123';

    beforeEach(() => {
      jest
        .spyOn(service as any, 'ensureLiveSender')
        .mockResolvedValue(undefined);
      // Mock that the actor has permission and belongs to a group named "42 Chat"
      jest
        .spyOn(service as any, 'ensureGroupManagementPermission')
        .mockResolvedValue({
          role: 'ADMIN',
          conversation: { title: '42 Chat' },
        });
    });

    it('Scenario 1: should throw BadRequest if user tries to remove himself', async () => {
      await expect(
        service.removeUserFromGroup(actorId, convId, actorId),
      ).rejects.toThrow(
        new BadRequestException('To quit the group click on the leave option'),
      );
    });

    it('Scenario 2: should throw NotFound if target is not in the conversation', async () => {
      jest
        .spyOn(prisma.client.conversationParticipant, 'findUnique')
        .mockResolvedValue(null);

      await expect(
        service.removeUserFromGroup(actorId, convId, targetId),
      ).rejects.toThrow(
        new NotFoundException('target user is not in this conversation'),
      );
    });

    it('Scenario 3: should throw Forbidden if an ADMIN tries to remove an OWNER', async () => {
      // Target is an OWNER
      jest
        .spyOn(prisma.client.conversationParticipant, 'findUnique')
        .mockResolvedValue({ role: 'OWNER' } as any);

      // Actor is an ADMIN (set in beforeEach)
      await expect(
        service.removeUserFromGroup(actorId, convId, targetId),
      ).rejects.toThrow(
        new ForbiddenException('only the room owner can remove another user'),
      );
    });

    it('Scenario 4: should throw BadRequest if target is the last participant', async () => {
      jest
        .spyOn(prisma.client.conversationParticipant, 'findUnique')
        .mockResolvedValue({ role: 'MEMBER' } as any);
      // Only 1 person left
      jest
        .spyOn(prisma.client.conversationParticipant, 'count')
        .mockResolvedValue(1);

      await expect(
        service.removeUserFromGroup(actorId, convId, targetId),
      ).rejects.toThrow(
        new BadRequestException('cannot remove the last participant'),
      );
    });

    it('Scenario 5: Success - remove user from group', async () => {
      jest
        .spyOn(prisma.client.conversationParticipant, 'findUnique')
        .mockResolvedValue({ role: 'MEMBER' } as any);
      jest
        .spyOn(prisma.client.conversationParticipant, 'count')
        .mockResolvedValue(5); // Plenty of people
      jest.spyOn(prisma.client, '$transaction').mockResolvedValue([]);

      const result = await service.removeUserFromGroup(
        actorId,
        convId,
        targetId,
      );

      expect(result.message).toBe('user removed from group');
      expect(result.removedUserId).toBe(targetId);
      expect(prisma.client.$transaction).toHaveBeenCalled();
    });
  });

  describe('inviteUsers', () => {
    const actorId = 'actor-id';
    const conversationId = 'convX';
    beforeEach(() => {
      // Mock the internal check methods to pass
      jest
        .spyOn(service as any, 'ensureLiveSender')
        .mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'ensureCanInviteToConversation')
        .mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'ensureUsersCanBeAdded')
        .mockResolvedValue(undefined);
    });
    it('Scenario 1: should throw BadRequest if normalized users list is empty', async () => {
      const invalidDto = { userIds: ['   ', 'actor-id'] }; // Spaces and the actor himself

      await expect(
        service.inviteUsers(actorId, conversationId, invalidDto),
      ).rejects.toThrow(new BadRequestException('no valid users to invite'));
    });

    it('Scenario 2: should return early if all users are already participants', async () => {
      const dto = { userIds: ['user-already-in'] };

      // Mock: Database says this user is already a participant
      jest
        .spyOn(prisma.client.conversationParticipant, 'findMany')
        .mockResolvedValue([
          { userId: 'user-already-in', leftAt: null },
        ] as any);

      const result = await service.inviteUsers(actorId, conversationId, dto);

      expect(result.message).toBe(
        'all selected users are already in the conversation',
      );
      expect(result.invitedCount).toBe(0);
      expect(mockTick.conversationParticipant.create).not.toHaveBeenCalled();
      expect(mockTick.conversationParticipant.update).not.toHaveBeenCalled();
    });

    it('Scenario 3: should successfully invite new users via transaction', async () => {
      const dto = { userIds: ['new-user', 'existing-user'] };

      // 1. Mock: 'existing-user' is already in, 'new-user' is not
      jest
        .spyOn(prisma.client.conversationParticipant, 'findMany')
        .mockResolvedValue([{ userId: 'existing-user', leftAt: null }] as any);
      mockTick.conversationParticipant.create.mockResolvedValue({} as any);
      mockTick.conversation.update.mockResolvedValue({} as any);

      // 2. Mock: The final conversation fetch
      const mockConv = { id: conversationId, participants: [] };
      jest
        .spyOn(prisma.client.conversation, 'findUnique')
        .mockResolvedValue(mockConv as any);

      // 3. Act
      const result = await service.inviteUsers(actorId, conversationId, dto);

      // 4. Assert
      expect(result.message).toBe('users invited successfully');
      expect(result.invitedCount).toBe(1); // Only 'new-user' was added
      expect(result.invitedUserIds).toEqual(['new-user']);

      // Verify transaction was called
      expect(prisma.client.$transaction).toHaveBeenCalled();
      expect(mockTick.conversationParticipant.create).toHaveBeenCalledWith({
        data: {
          conversationId,
          userId: 'new-user',
          role: 'MEMBER',
          joinedAt: expect.any(Date),
          leftAt: null,
        },
      });
    });
  });

  describe('createGroupConversation', () => {
    const actorId = 'owner-id';

    // Example DTO
    const validDto = {
      title: '  My 42 Group  ', // includes spaces to test trimming
      userIds: ['user-1', 'user-2', ' user-1'], // includes duplicate
    };

    it('Scenario 1: should throw BadRequest if less than 2 valid users remain', async () => {
      const invalidDto = {
        title: 'Fail',
        userIds: ['user-1', ' user-1'], // Only 1 user
      };

      await expect(
        service.createGroupConversation(actorId, invalidDto),
      ).rejects.toThrow(
        new BadRequestException(
          'a group conversation must contain at least 2 other users',
        ),
      );
    });

    it('Scenario 2: should create a group successfully', async () => {
      // 1. Mock the internal validations to pass
      jest
        .spyOn(service as any, 'ensureLiveSender')
        .mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'ensureUsersCanBeAdded')
        .mockResolvedValue(undefined);

      // 2. Mock Prisma create
      const mockCreatedConv = { id: 'new-conv-uuid', title: 'My 42 Group' };
      jest
        .spyOn(prisma.client.conversation, 'create')
        .mockResolvedValue(mockCreatedConv as any);

      // 3. Act
      const result = await service.createGroupConversation(actorId, validDto);

      // 4. Assert
      expect(result.message).toBe('group conversation created');
      expect(result.conversation).toEqual(mockCreatedConv);

      // Verify normalization worked in the DB call:
      // It should have trimmed the title and removed the duplicate 'user-1'
      expect(prisma.client.conversation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'My 42 Group', // Trimmed
            participants: {
              create: [
                { userId: actorId, role: 'OWNER' },
                { userId: 'user-1', role: 'MEMBER' }, // Only once!
                { userId: 'user-2', role: 'MEMBER' },
              ],
            },
          }),
        }),
      );
    });

    it('Scenario 3: should throw if ensureUsersCanBeAdded fails', async () => {
      // Mocking one of the validation methods to fail (e.g. someone is blocked)
      jest
        .spyOn(service as any, 'ensureLiveSender')
        .mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'ensureUsersCanBeAdded')
        .mockRejectedValue(new BadRequestException('User is banned'));

      await expect(
        service.createGroupConversation(actorId, validDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createOrGetDirectConversation', () => {
    const actorId = 'user-1';
    const targetId = 'user-2';
    const mockConversation = {
      id: 'conv-id',
      type: 'DIRECT',
      participantHash: 'DM_user-1_user-2',
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
      mockTick.conversation.findUnique.mockResolvedValue(mockConversation);

      // 2. Act
      const result = await service.createOrGetDirectConversation(
        actorId,
        targetId,
      );

      // 3. Assert
      expect(result).toEqual(mockConversation);
      expect(mockTick.conversation.findUnique).toHaveBeenCalled();
      // CRITICAL: Ensure create was NOT called because it already existed
      expect(mockTick.conversation.create).not.toHaveBeenCalled();
    });

    it('Scenario 2: should create a new conversation if none exists', async () => {
      // 1. Arrange: findUnique returns null, create returns a new conversation
      mockTick.conversation.findUnique.mockResolvedValue(null);
      mockTick.conversation.create.mockResolvedValue(mockConversation);
      // 2. Act
      const result = await service.createOrGetDirectConversation(
        actorId,
        targetId,
      );

      // 3. Assert
      expect(result).toEqual(mockConversation);
      expect(mockTick.conversation.findUnique).toHaveBeenCalled();
      expect(mockTick.conversation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'DIRECT',
            participantHash: 'DM_user-1_user-2',
            participants: expect.anything(),
          }),
        }),
      );
    });

    it('Scenario 3: should throw if validation fails', async () => {
      // 1. Arrange: Mock the validation to FAIL
      mockTick.conversation.findUnique.mockRejectedValue(
        new ForbiddenException('Blocked'),
      );

      // 2. Act & Assert
      await expect(
        service.createOrGetDirectConversation(actorId, targetId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Scenario 4: should handle P2002 race condition by retrying findUnique', async () => {
      mockTick.conversation.findUnique.mockResolvedValueOnce(null); // First check: not found

      // 2. Create an error that mimics Prisma's structure
      // We use 'Object.create' to trick the 'instanceof' check
      const p2002Error = Object.create(
        Prisma.PrismaClientKnownRequestError.prototype,
      );
      p2002Error.code = 'P2002';
      p2002Error.message = 'Unique constraint failed';
      mockTick.conversation.create.mockRejectedValue(p2002Error);

      // Second check (the 'catch' block recovery)
      const finalConv = { id: 'cuid_recovered' };
      mockPrisma.client.conversation.findUnique.mockResolvedValue(finalConv);

      const result = await service.createOrGetDirectConversation('A', 'B');
      expect(result).toEqual(finalConv);
      expect(mockPrisma.client.conversation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { participantHash: 'DM_A_B' },
        }),
      );
    });
  });

  describe('ensureConversationMembership', () => {
    const conversationId = 'conv-123';
    const userId = 'User1';

    it('scenario 1: should return a forbiddenExeception if user is not part of the conversation', async () => {
      jest
        .spyOn(prisma.client.conversationParticipant, 'findUnique')
        .mockResolvedValue(null);
      await expect(
        service.ensureConversationMembership(userId, conversationId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('scenario 2: should return membership as user part of the conversation', async () => {
      const mockUser = {
        conversationId: 'conv-123',
        userId: 'User1',
        leftAt: null,
      };
      jest
        .spyOn(prisma.client.conversationParticipant, 'findUnique')
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

      jest
        .spyOn(prisma.client.conversationParticipant, 'findMany')
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
      expect(
        prisma.client.conversationParticipant.findMany,
      ).toHaveBeenCalledWith({
        where: { conversationId, leftAt: null },
        select: { userId: true },
      });
    });

    it('scenario 2: should return an empty array if the current user is the only participant', async () => {
      // Arrange: Only the current user is in the room
      const mockParticipants = [{ userId: currentUserId }];

      jest
        .spyOn(prisma.client.conversationParticipant, 'findMany')
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
        .spyOn(prisma.client.conversationParticipant, 'findUnique')
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

      jest
        .spyOn(prisma.client.conversationParticipant, 'findUnique')
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

      jest
        .spyOn(prisma.client.conversationParticipant, 'findUnique')
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
      jest.spyOn(prisma.client.user, 'findMany').mockResolvedValue([]);

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
      jest
        .spyOn(prisma.client.user, 'findMany')
        .mockResolvedValue([mockUser] as any);

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
      jest
        .spyOn(prisma.client.user, 'findMany')
        .mockResolvedValue([mockUser] as any);

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
      jest
        .spyOn(prisma.client.user, 'findMany')
        .mockResolvedValue([mockUser] as any);

      // Setup: but a block is found
      jest
        .spyOn(prisma.client.block, 'findFirst')
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
      jest
        .spyOn(prisma.client.user, 'findMany')
        .mockResolvedValue(mockUsers as any);

      // 2. Mock NO block found (Return null!)
      jest.spyOn(prisma.client.block, 'findFirst').mockResolvedValue(null);

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
