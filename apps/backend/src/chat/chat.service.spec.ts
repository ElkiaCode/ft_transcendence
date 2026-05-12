import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service'; // Adjust path if needed
import { AutoModerationService } from '../moderation/auto-moderation.service'; // Adjust path if needed
import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

describe('ChatService', () => {
  let service: ChatService;
  let prisma: PrismaService;

  beforeEach(async () => {
    // 1. Define what the 'tx' (transaction client) looks like for callbacks
    const mockTick = {
      conversationParticipant: {
        delete: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        createMany: jest.fn().mockResolvedValue({}),
      },
      conversation: {
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
    providers: [
      ChatService,
      {
        provide: PrismaService,
        useValue: {
          // 2. The Smart Mock logic
          $transaction: jest.fn((input) => {
            // If it's a callback: $transaction(async (tx) => { ... })
            if (typeof input === 'function') {
              return input(mockTick);
            }
            // If it's an array: $transaction([p1, p2])
            return Promise.all(input);
          }),
          
          // 3. Keep your standard mocks here for non-transaction calls
            user: {
              findMany: jest.fn(),
            },
            block: {
              findFirst: jest.fn(),
            },
            conversation: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            message: {
              findMany: jest.fn(),
              create: jest.fn(),
            },
            conversationParticipant: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
              createMany: jest.fn(),
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

  describe('renameConversation', () => {
    const actorUserId = 'renamer-id';
    const conversationId = 'conv-123';
    beforeEach(() => {
      // 1. Mock internal validations to always pass
      jest.spyOn(service as any, 'ensureLiveSender').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'ensureGroupManagementPermission').mockResolvedValue({ 
        id: conversationId 
      });
    });  

    it('Scenario 1: should throw BadRequestException when no title entered', async () => {
      const titleConvFail = ' ';

      await expect(
        service.renameConversation(actorUserId, conversationId, titleConvFail)
      ).rejects.toThrow(new BadRequestException('conversation title cannot be empty'));
    })

    it('Scenario 2: should pass successfully', async () => {
      const titleConvPass = 'Title is OK ';
      const expectedTrimmedTitle = 'Title is OK';

      const mockUpdatedConv = { id: conversationId, title: expectedTrimmedTitle };
      jest.spyOn(prisma.conversation, 'update').mockResolvedValue(mockUpdatedConv as any);

      // 3. Act
      const result = await service.renameConversation(actorUserId, conversationId, titleConvPass);

      // 4. Assert
      expect(result.message).toBe('conversation renamed successfully');
      expect(result.conversation.title).toBe(expectedTrimmedTitle);

      // 5. Critical Verification: Was the DB called with the TRIMMED title?
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: conversationId },
        data: expect.objectContaining({
          title: expectedTrimmedTitle,
        }),
      });
    });

    it('Scenario 3: should throw if user has no management permission', async () => {
      // Mocking the permission check to FAIL
      jest.spyOn(service as any, 'ensureGroupManagementPermission')
        .mockRejectedValue(new ForbiddenException('No permission'));

      await expect(
        service.renameConversation(actorUserId, conversationId, 'Valid Title')
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('leaveConversation', () => {
    const userId = 'leaver-id';
    const otherUserId = 'senior-member-id';
    const convId = 'group-123';

    beforeEach(() => {
      jest.spyOn(service as any, 'ensureLiveSender').mockResolvedValue(undefined);
    });
    // Scenario 1: Not a participant
    // Mock findUnique to return null. (Throws ForbiddenException).
    it('Scenario 1: should throw ForbiddenException when no participant into conversation', async () => {
      jest.spyOn(prisma.conversationParticipant, 'findUnique').mockResolvedValue(null);

      await expect(
        service.removeUserFromGroup('  ', convId, '   ')
      ).rejects.toThrow(ForbiddenException);
    })
    // Scenario 2: Not a GROUP
    // Mock findUnique to return a membership where conversation.type = 'DIRECT'. (Throws BadRequestException).
    it('Scenario 2: should throw BadRequest if leaver is leaving a direct conversation', async () => {
      jest.spyOn(prisma.conversationParticipant, 'findUnique').mockResolvedValue({
        role: 'MEMBER',
        conversation: { type: 'DIRECT' }
      } as any);
      
      jest.spyOn(prisma.conversationParticipant, 'findMany').mockResolvedValue([
        { userId, otherUserId }
      ] as any);

      await expect(service.leaveConversation(userId, convId))
        .rejects.toThrow(BadRequestException);
    });

    it('Scenario 3: should throw BadRequest if leaver is the last participant', async () => {
      jest.spyOn(prisma.conversationParticipant, 'findUnique').mockResolvedValue({
        role: 'MEMBER',
        conversation: { type: 'GROUP' }
      } as any);
      
      // Only 1 person in the list
      jest.spyOn(prisma.conversationParticipant, 'findMany').mockResolvedValue([
        { userId }
      ] as any);

      await expect(service.leaveConversation(userId, convId))
        .rejects.toThrow('Cannot leave the last participant');
    });

    it('Scenario 4: should allow a MEMBER to leave without transferring ownership', async () => {
      jest.spyOn(prisma.conversationParticipant, 'findUnique').mockResolvedValue({
        role: 'MEMBER',
        conversation: { type: 'GROUP', title: 'Test Room' }
      } as any);

      jest.spyOn(prisma.conversationParticipant, 'findMany').mockResolvedValue([
        { userId: 'owner-id', joinedAt: new Date(100) },
        { userId, joinedAt: new Date(200) }
      ] as any);

      const result = await service.leaveConversation(userId, convId);

      expect(result.previousRole).toBe('MEMBER');
      expect(result.nextOwnerId).toBeNull();
      expect(result.message).toBe('left conversation successfully');
    });

    it('Scenario 5: should transfer ownership to the oldest member when OWNER leaves', async () => {
      // 1. Leaver is the OWNER
      jest.spyOn(prisma.conversationParticipant, 'findUnique').mockResolvedValue({
        role: 'OWNER',
        conversation: { type: 'GROUP', title: 'Owner Room' }
      } as any);

      // 2. Participants list (ordered by joinedAt)
      // index 0 is owner (leaving), index 1 is the oldest remaining
      const mockParticipants = [
        { userId, joinedAt: new Date(100) },
        { userId: otherUserId, joinedAt: new Date(200) },
        { userId: 'newbie-id', joinedAt: new Date(300) }
      ];
      jest.spyOn(prisma.conversationParticipant, 'findMany').mockResolvedValue(mockParticipants as any);

      const result = await service.leaveConversation(userId, convId);

      // 3. Assertions
      expect(result.previousRole).toBe('OWNER');
      expect(result.nextOwnerId).toBe(otherUserId); // The senior member
      expect(result.remainingUserIds).toContain(otherUserId);
      expect(result.remainingUserIds).not.toContain(userId);
      
      // Check if transaction was called (Logic verification)
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('removeUserFromGroup', () => {
    const actorId = 'actor-admin';
    const targetId = 'target-user';
    const convId = 'conv-123';

    beforeEach(() => {
      jest.spyOn(service as any, 'ensureLiveSender').mockResolvedValue(undefined);
      // Mock that the actor has permission and belongs to a group named "42 Chat"
      jest.spyOn(service as any, 'ensureGroupManagementPermission').mockResolvedValue({
        role: 'ADMIN',
        conversation: { title: '42 Chat' }
      });
    });

    it('Scenario 1: should throw BadRequest if user tries to remove himself', async () => {
      await expect(
        service.removeUserFromGroup(actorId, convId, actorId) // actor == target
      ).rejects.toThrow(new BadRequestException('To quit the group click on the leave option'));
    });

    it('Scenario 2: should throw NotFound if target is not in the conversation', async () => {
      jest.spyOn(prisma.conversationParticipant, 'findUnique').mockResolvedValue(null);

      await expect(
        service.removeUserFromGroup(actorId, convId, targetId)
      ).rejects.toThrow(NotFoundException);
    });

    it('Scenario 3: should throw Forbidden if an ADMIN tries to remove an OWNER', async () => {
      // Target is an OWNER
      jest.spyOn(prisma.conversationParticipant, 'findUnique').mockResolvedValue({ role: 'OWNER' } as any);
      
      // Actor is an ADMIN (set in beforeEach)
      await expect(
        service.removeUserFromGroup(actorId, convId, targetId)
      ).rejects.toThrow(ForbiddenException);
    });

    it('Scenario 4: should throw BadRequest if target is the last participant', async () => {
      jest.spyOn(prisma.conversationParticipant, 'findUnique').mockResolvedValue({ role: 'MEMBER' } as any);
      // Only 1 person left
      jest.spyOn(prisma.conversationParticipant, 'count').mockResolvedValue(1);

      await expect(
        service.removeUserFromGroup(actorId, convId, targetId)
      ).rejects.toThrow(new BadRequestException('cannot remove the last participant'));
    });

    it('Scenario 5: Success - remove user from group', async () => {
      jest.spyOn(prisma.conversationParticipant, 'findUnique').mockResolvedValue({ role: 'MEMBER' } as any);
      jest.spyOn(prisma.conversationParticipant, 'count').mockResolvedValue(5); // Plenty of people
      jest.spyOn(prisma, '$transaction').mockResolvedValue([] as any);

      const result = await service.removeUserFromGroup(actorId, convId, targetId);

      expect(result.message).toBe('user removed from group');
      expect(result.removedUserId).toBe(targetId);
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('inviteUsers', () => {
    const actorId = 'actor-id';
    const conversationId = 'convX';
    beforeEach(() => {
      // Mock the internal check methods to pass
      jest.spyOn(service as any, 'ensureLiveSender').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'ensureCanInviteToConversation').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'ensureUsersCanBeAdded').mockResolvedValue(undefined);
    });
    const validDto = {
      userIds: ['user-1', 'user-2', ' user-1'], // includes duplicate
    };
    it('Scenario 1: should throw BadRequest if normalized users list is empty', async () => {
      const invalidDto = { userIds: ['   ', 'actor-id'] }; // Spaces and the actor himself

      await expect(
        service.inviteUsers(actorId, conversationId, invalidDto)
      ).rejects.toThrow(new BadRequestException('no valid users to invite'));
    });

    it('Scenario 2: should return early if all users are already participants', async () => {
      const dto = { userIds: ['user-already-in'] };
      
      // Mock: Database says this user is already a participant
      jest.spyOn(prisma.conversationParticipant, 'findMany').mockResolvedValue([
        { userId: 'user-already-in' }
      ] as any);

      const result = await service.inviteUsers(actorId, conversationId, dto);

      expect(result.message).toBe('all selected users are already in the conversation');
      expect(result.invitedCount).toBe(0);
      // CRITICAL: Ensure transaction was NEVER called
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('Scenario 3: should successfully invite new users via transaction', async () => {
      const dto = { userIds: ['new-user', 'existing-user'] };

      // 1. Mock: 'existing-user' is already in, 'new-user' is not
      jest.spyOn(prisma.conversationParticipant, 'findMany').mockResolvedValue([
        { userId: 'existing-user' }
      ] as any);

      // 2. Mock: The final conversation fetch
      const mockConv = { id: conversationId, participants: [] };
      jest.spyOn(prisma.conversation, 'findUnique').mockResolvedValue(mockConv as any);

      // 3. Act
      const result = await service.inviteUsers(actorId, conversationId, dto);

      // 4. Assert
      expect(result.message).toBe('users invited successfully');
      expect(result.invitedCount).toBe(1); // Only 'new-user' was added
      expect(result.invitedUserIds).toEqual(['new-user']);
      
      // Verify transaction was called
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.conversationParticipant.createMany).toHaveBeenCalledWith({
        data: [{ conversationId, userId: 'new-user', role: 'MEMBER' }]
      });
    });
  });

  describe('createGroupeConversation', () => {
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
        service.createGroupeConversation(actorId, invalidDto)
      ).rejects.toThrow(new BadRequestException('a group conversation must contain at least 2 other users'));
    });

    it('Scenario 2: should create a group successfully', async () => {
      // 1. Mock the internal validations to pass
      jest.spyOn(service as any, 'ensureLiveSender').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'ensureUsersCanBeAdded').mockResolvedValue(undefined);

      // 2. Mock Prisma create
      const mockCreatedConv = { id: 'new-conv-uuid', title: 'My 42 Group' };
      jest.spyOn(prisma.conversation, 'create').mockResolvedValue(mockCreatedConv as any);

      // 3. Act
      const result = await service.createGroupeConversation(actorId, validDto);

      // 4. Assert
      expect(result.message).toBe('group conversation created');
      expect(result.conversation).toEqual(mockCreatedConv);

      // Verify normalization worked in the DB call:
      // It should have trimmed the title and removed the duplicate 'user-1'
      expect(prisma.conversation.create).toHaveBeenCalledWith(
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
        })
      );
    });

    it('Scenario 3: should throw if ensureUsersCanBeAdded fails', async () => {
      // Mocking one of the validation methods to fail (e.g. someone is blocked)
      jest.spyOn(service as any, 'ensureLiveSender').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'ensureUsersCanBeAdded')
        .mockRejectedValue(new BadRequestException('User is banned'));

      await expect(
        service.createGroupeConversation(actorId, validDto)
      ).rejects.toThrow(BadRequestException);
    });
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
