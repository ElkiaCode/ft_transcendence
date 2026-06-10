import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InviteUsersDto } from './dto/invite-users.dto';
import { CreateGroupConversationDto } from './dto/create-group-conversation.dto';
import {
  AutoModerationService,
  ModerationApplyResult,
} from '../moderation/auto-moderation.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ChatService {
  private readonly positiveReactionPointValue = 5;
  private readonly automaticModerationPlaceholder =
    'message deleted by automatic moderation';

  constructor(
    private readonly prisma: PrismaService,
    private readonly autoModerationService: AutoModerationService,
  ) {}

  private async ensureGroupConversationExists(conversationId: string) {
    const conversation = await this.prisma.client.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: true,
      },
    });

    if (!conversation) {
      throw new NotFoundException('conversation not found');
    }

    if (conversation.type !== 'GROUP') {
      throw new BadRequestException(
        'this action is only allowed for group conversations',
      );
    }

    return conversation;
  }

  private async ensureGroupManagementPermission(
    actorUserId: string,
    conversationId: string,
  ) {
    const membership =
      await this.prisma.client.conversationParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId,
            userId: actorUserId,
          },
        },
        include: {
          conversation: true,
        },
      });

    if (!membership) {
      throw new ForbiddenException(
        'you are not a participant of this conversation',
      );
    }

    if (membership.conversation.type !== 'GROUP') {
      throw new BadRequestException(
        'this action is only allowed for group conversations',
      );
    }

    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      throw new ForbiddenException('only room owner or admin can do this');
    }

    return membership;
  }

  async ensureUsersCanBeAdded(actorUserId: string, targetUserIds: string[]) {
    const users = await this.prisma.client.user.findMany({
      where: { id: { in: targetUserIds } },
      select: {
        id: true,
        username: true,
        isActive: true,
        isBanned: true,
      },
    });

    if (users.length !== targetUserIds.length) {
      throw new BadRequestException(
        'One or more selected users does not exist',
      );
    }

    for (const user of users) {
      if (!user.isActive || user.isBanned) {
        throw new BadRequestException(
          `user ${user.username} cannot be added to the conversation`,
        );
      }

      const block = await this.prisma.client.block.findFirst({
        where: {
          OR: [
            { blockerId: actorUserId, blockedId: user.id },
            { blockerId: user.id, blockedId: actorUserId },
          ],
        },
      });

      if (block) {
        throw new ForbiddenException(
          `cannot add ${user.username} because one of you has blocked the other`,
        );
      }
    }

    return users;
  }

  async ensureCanInviteToConversation(
    actorUserId: string,
    conversationId: string,
  ) {
    const membership =
      await this.prisma.client.conversationParticipant.findUnique({
        where: {
          conversationId_userId: { conversationId, userId: actorUserId },
        },
        include: { conversation: true },
      });

    if (!membership) {
      throw new ForbiddenException(
        'You are not a participant of this conversation',
      );
    }

    if (membership.conversation.type !== 'GROUP') {
      throw new BadRequestException(
        'You can only invite users to a group conversation',
      );
    }
    return membership;
  }

  async getOtherParticipantIds(conversationId: string, currentUserId: string) {
    const participants =
      await this.prisma.client.conversationParticipant.findMany({
        where: {
          conversationId,
          leftAt: null,
        },
        select: { userId: true },
      });

    return participants
      .map((p) => p.userId)
      .filter((id) => id !== currentUserId);
  }

  private async ensureLiveSender(userId: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('user not found');
    }

    if (!user.isActive) {
      throw new ForbiddenException('account is inactive');
    }

    if (user.isBanned) {
      throw new ForbiddenException('account is banned');
    }

    return user;
  }

  private async ensureUserExists(userId: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        isActive: true,
        isBanned: true,
      },
    });

    if (!user) {
      throw new NotFoundException('user not found');
    }

    return user;
  }

  private async ensureCanDirectMessage(
    actorUserId: string,
    targetUserId: string,
  ) {
    if (actorUserId === targetUserId) {
      throw new BadRequestException('cannot message yourself');
    }

    const [actor, target, block] = await Promise.all([
      this.ensureUserExists(actorUserId),
      this.ensureUserExists(targetUserId),
      this.prisma.client.block.findFirst({
        where: {
          OR: [
            { blockerId: actorUserId, blockedId: targetUserId },
            { blockerId: targetUserId, blockedId: actorUserId },
          ],
        },
      }),
    ]);

    if (!actor.isActive || actor.isBanned) {
      throw new ForbiddenException('your account cannot do this');
    }

    if (!target.isActive || target.isBanned) {
      throw new ForbiddenException('target user cannot receive messages');
    }

    if (block) {
      throw new ForbiddenException('messaging is blocked between these users');
    }

    return { actor, target };
  }

  async ensureConversationMembership(userId: string, conversationId: string) {
    const membership =
      await this.prisma.client.conversationParticipant.findUnique({
        where: {
          conversationId_userId: { conversationId, userId },
        },
      });

    if (!membership) {
      throw new ForbiddenException(
        'you are not and were never a participant of this conversation',
      );
    }

    return membership;
  }

  private normalizeTargetUserIds(rawUserIds: string[], actorUserId: string) {
    return [...new Set(rawUserIds.map((id) => id.trim()))].filter(
      (id) => id.length > 0 && id !== actorUserId,
    );
  }

  private buildAutomaticBanReason(categories: string[]) {
    return categories.length > 0 ? categories.join(', ') : 'harmful message';
  }

  async createOrGetDirectConversation(
    actorUserId: string,
    targetUserId: string,
  ) {
    // 1. Safety check
    await this.ensureCanDirectMessage(actorUserId, targetUserId);
    // 2. Normalize the ID order to create a unique key
    const [minId, maxId] = [actorUserId, targetUserId].sort();
    const hash = `DM_${minId}_${maxId}`;
    // 3. deepInclude definition
    const deepInclude = {
      participants: {
        include: {
          user: {
            include: {
              profile: true,
            },
          },
        },
      },
    };
    // 4. Use of a transaction to prevent double-creation during concurrent requests
    try {
      return await this.prisma.client.$transaction(async (tx) => {
        //4.1. Check if it exists within the transaction
        const existing = await tx.conversation.findUnique({
          where: { participantHash: hash },
          include: deepInclude,
        });

        if (existing) return existing;

        //4.2. If not, create it
        return await tx.conversation.create({
          data: {
            type: 'DIRECT',
            participantHash: hash,
            participants: {
              create: [
                { userId: actorUserId, role: 'OWNER' },
                { userId: targetUserId, role: 'OWNER' },
              ],
            },
          },
          include: deepInclude,
        });
      });
    } catch (error) {
      // 4.3. Check if the error is a Unique Constraint Violation (P2002)
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          // RACE CONDITION DETECTED:
          // Another request created the conversation between Step 1 and Step 2.
          // Simply fetch the one that was just created by the other request.
          return this.prisma.client.conversation.findUnique({
            where: { participantHash: hash },
            include: deepInclude,
          });
        }
      }
      // If it's another type of error, throw it so the Controller/Interceptor handles it
      throw error;
    }
  }

  async createGroupConversation(
    actorUserId: string,
    dto: CreateGroupConversationDto,
  ) {
    const targetUserIds = this.normalizeTargetUserIds(dto.userIds, actorUserId);

    if (targetUserIds.length < 2) {
      throw new BadRequestException(
        'a group conversation must contain at least 2 other users',
      );
    }

    await this.ensureLiveSender(actorUserId);
    await this.ensureUsersCanBeAdded(actorUserId, targetUserIds);

    const conversation = await this.prisma.client.conversation.create({
      data: {
        type: 'GROUP',
        title: dto.title?.trim() || null,
        participantHash: null,
        participants: {
          create: [
            {
              userId: actorUserId,
              role: 'OWNER',
            },
            ...targetUserIds.map((userId) => ({
              userId,
              role: 'MEMBER' as const,
            })),
          ],
        },
      },
      include: {
        participants: {
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        },
      },
    });

    return {
      message: 'group conversation created',
      conversation,
    };
  }

  async inviteUsers(
    actorUserId: string,
    conversationId: string,
    dto: InviteUsersDto,
  ) {
    await this.ensureLiveSender(actorUserId);
    await this.ensureCanInviteToConversation(actorUserId, conversationId);

    const normalizedUserIds = this.normalizeTargetUserIds(
      dto.userIds,
      actorUserId,
    );

    if (normalizedUserIds.length === 0) {
      throw new BadRequestException('no valid users to invite');
    }

    await this.ensureUsersCanBeAdded(actorUserId, normalizedUserIds);

    const existingRecords =
      await this.prisma.client.conversationParticipant.findMany({
        where: {
          conversationId,
          userId: { in: normalizedUserIds },
        },
        // select: {
        //   userId: true,
        // },
      });

    const recordsMap = new Map(existingRecords.map((r) => [r.userId, r]));
    const invitedUserIds: string[] = [];

    // Use a transaction to handle multiple users
    await this.prisma.client.$transaction(async (tx) => {
      for (const targetId of normalizedUserIds) {
        const record = recordsMap.get(targetId);

        if (!record) {
          // CASE A: User never been in the group. Create fresh.
          await tx.conversationParticipant.create({
            data: {
              conversationId,
              userId: targetId,
              role: 'MEMBER',
              joinedAt: new Date(),
              leftAt: null,
            },
          });
          invitedUserIds.push(targetId);
        } else if (record.leftAt !== null) {
          // CASE B: User was in the group but LEFT. Re-activate and RESET timeline.
          await tx.conversationParticipant.update({
            where: { id: record.id },
            data: {
              joinedAt: new Date(), // GDPR: Starts their view from now
              leftAt: null, // Make them active again
              role: 'MEMBER',
            },
          });
          invitedUserIds.push(targetId);
        }
        // CASE C: record.leftAt === null
        // Do nothing. They are already in the group.
        // We DON'T update joinedAt here so we don't break their history.
      }

      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
    });

    if (invitedUserIds.length === 0) {
      return {
        message: 'all selected users are already in the conversation',
        invitedCount: 0,
        invitedUserIds: [],
        conversation: null,
      };
    }

    const conversation = await this.prisma.client.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        },
      },
    });

    return {
      message: 'users invited successfully',
      invitedCount: invitedUserIds.length,
      invitedUserIds: invitedUserIds,
      conversation,
    };
  }

  async removeUserFromGroup(
    actorUserId: string,
    conversationId: string,
    targetUserId: string,
  ) {
    await this.ensureLiveSender(actorUserId);
    const actorMembership = await this.ensureGroupManagementPermission(
      actorUserId,
      conversationId,
    );

    if (actorUserId === targetUserId) {
      throw new BadRequestException(
        'To quit the group click on the leave option',
      );
    }

    const targetMembership =
      await this.prisma.client.conversationParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId,
            userId: targetUserId,
          },
        },
      });

    if (!targetMembership) {
      throw new NotFoundException('target user is not in this conversation');
    }

    if (targetMembership.role === 'OWNER' && actorMembership.role !== 'OWNER') {
      throw new ForbiddenException(
        'only the room owner can remove another user',
      );
    }

    const remainingParticipantsCount =
      await this.prisma.client.conversationParticipant.count({
        where: { conversationId },
      });

    if (remainingParticipantsCount <= 1) {
      throw new BadRequestException('cannot remove the last participant');
    }

    await this.prisma.client.$transaction([
      this.prisma.client.conversationParticipant.update({
        where: {
          conversationId_userId: {
            conversationId,
            userId: targetUserId,
          },
        },
        data: { leftAt: new Date() },
      }),
      this.prisma.client.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
    ]);

    return {
      message: 'user removed from group',
      removedUserId: targetUserId,
      conversationId,
      conversationTitle: actorMembership.conversation.title ?? 'Group chat',
    };
  }

  async leaveConversation(userId: string, conversationId: string) {
    await this.ensureLiveSender(userId);

    const membership =
      await this.prisma.client.conversationParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
        include: {
          conversation: true,
        },
      });

    if (!membership) {
      throw new ForbiddenException(
        'You are not a participant of this conversation',
      );
    }

    if (membership.conversation.type !== 'GROUP') {
      throw new BadRequestException(
        'leave is only supported for group conversation',
      );
    }

    const participants =
      await this.prisma.client.conversationParticipant.findMany({
        where: { conversationId },
        orderBy: { joinedAt: 'asc' },
      });

    if (participants.length <= 1) {
      throw new BadRequestException('Cannot leave the last participant');
    }

    const otherParticipants = participants.filter((p) => p.userId !== userId);
    const remainingUserIds = otherParticipants.map((p) => p.userId);
    const previousRole = membership.role;
    const nextOwnerId =
      previousRole === 'OWNER' ? otherParticipants[0]?.userId : null;

    await this.prisma.client.$transaction(async (tx) => {
      await tx.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { leftAt: new Date() }, // Mark the exit time
      });

      if (previousRole === 'OWNER') {
        const nextOwner = otherParticipants[0];

        await tx.conversationParticipant.update({
          where: {
            conversationId_userId: {
              conversationId,
              userId: nextOwner.userId,
            },
          },
          data: { role: 'OWNER' },
        });
      }

      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
    });

    return {
      message: 'left conversation successfully',
      conversationId,
      conversationTitle: membership.conversation.title ?? 'Group chat',
      remainingUserIds,
      previousRole,
      nextOwnerId,
    };
  }

  async renameConversation(
    actorUserId: string,
    conversationId: string,
    title: string,
  ) {
    await this.ensureLiveSender(actorUserId);
    await this.ensureGroupManagementPermission(actorUserId, conversationId);

    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      throw new BadRequestException('conversation title cannot be empty');
    }

    const conversation = await this.prisma.client.conversation.update({
      where: { id: conversationId },
      data: {
        title: trimmedTitle,
        updatedAt: new Date(),
      },
    });

    return {
      message: 'conversation renamed successfully',
      conversation,
    };
  }

  async listMyConversations(userId: string) {
    const conversations = await this.prisma.client.conversation.findMany({
      where: {
        participants: {
          some: {
            userId,
            leftAt: null, // Only show conversations the user is currently IN
          },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              include: { profile: true },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              include: { profile: true },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return conversations.map((conv) => {
      // 1. Find the specific membership for the current user to get their 'joinedAt'
      const myMembership = conv.participants.find((p) => p.userId === userId);

      const otherUser = conv.participants.find(
        (p) => p.userId !== userId,
      )?.user;

      const lastMessage = conv.messages[0];

      // 2. PRIVACY CHECK: Only show the last message content if it was sent
      // after the user's most recent joinedAt date.
      const isMessageVisible =
        lastMessage &&
        myMembership &&
        lastMessage.createdAt >= myMembership.joinedAt;

      return {
        id: conv.id,
        type: conv.type === 'DIRECT' ? 'dm' : 'group',
        name:
          conv.type === 'DIRECT'
            ? otherUser?.username
            : (conv.title ?? 'Group chat'),
        avatarUrl:
          conv.type === 'DIRECT'
            ? (otherUser?.profile?.avatarUrl ?? null)
            : null,
        lastMessage: isMessageVisible
          ? (lastMessage.content ?? 'Message deleted')
          : null,
        unreadCount: 0,
      };
    });
  }

  async listMessages(userId: string, conversationId: string) {
    // 1. Get the membership record (including those who left)
    const membership = await this.ensureConversationMembership(
      userId,
      conversationId,
    );

    // 2. Filter messages by the time the user was actually in the group
    return this.prisma.client.message
      .findMany({
        where: {
          conversationId,
          createdAt: {
            gte: membership.joinedAt,
            // If leftAt is null, they are still in the group (use current date)
            ...(membership.leftAt ? { lte: membership.leftAt } : {}),
          },
        },
        include: {
          sender: {
            include: { profile: true },
          },
          reads: {
            include: {
              user: {
                include: { profile: true },
              },
            },
            orderBy: { readAt: 'asc' },
          },
          reactions: {
            include: {
              user: {
                include: { profile: true },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      })
      .then((msgs) => msgs.reverse());
  }

  async listMembers(userId: string, conversationId: string) {
    await this.ensureConversationMembership(userId, conversationId);

    const participants =
      await this.prisma.client.conversationParticipant.findMany({
        where: {
          conversationId,
          leftAt: null,
        },
        include: {
          user: {
            include: { profile: true },
          },
        },
        orderBy: { joinedAt: 'asc' },
      });

    return participants.map((participant) => ({
      id: participant.id,
      userId: participant.userId,
      role: participant.role,
      joinedAt: participant.joinedAt,
      user: {
        id: participant.user.id,
        username: participant.user.username,
        displayName:
          participant.user.profile?.displayName ?? participant.user.username,
        avatarUrl: participant.user.profile?.avatarUrl ?? null,
      },
    }));
  }

  async editMessage(
    userId: string,
    conversationId: string,
    messageId: string,
    content: string,
  ) {
    await this.ensureLiveSender(userId);
    await this.ensureConversationMembership(userId, conversationId);

    const message = await this.prisma.client.message.findUnique({
      where: { id: messageId },
    });

    if (!message || message.conversationId !== conversationId) {
      throw new NotFoundException('message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('you can only edit your own messages');
    }

    if (message.deletedAt) {
      throw new BadRequestException('deleted messages cannot be edited');
    }

    await this.ensureLastMessage(conversationId, messageId, 'edit');

    const trimmed = content.trim();

    if (!trimmed) {
      throw new BadRequestException('message content is empty');
    }

    return this.prisma.client.message.update({
      where: { id: messageId },
      data: {
        content: trimmed,
        isEdited: true,
      },
      include: {
        sender: {
          include: { profile: true },
        },
        reads: {
          include: {
            user: {
              include: { profile: true },
            },
          },
        },
        reactions: {
          include: {
            user: {
              include: { profile: true },
            },
          },
        },
      },
    });
  }

  async deleteMessage(
    userId: string,
    conversationId: string,
    messageId: string,
  ) {
    await this.ensureLiveSender(userId);
    await this.ensureConversationMembership(userId, conversationId);

    const message = await this.prisma.client.message.findUnique({
      where: { id: messageId },
    });

    if (!message || message.conversationId !== conversationId) {
      throw new NotFoundException('message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('you can only delete your own messages');
    }

    if (message.deletedAt) {
      throw new BadRequestException('message already deleted');
    }

    await this.ensureLastMessage(conversationId, messageId, 'delete');

    return this.prisma.client.message.update({
      where: { id: messageId },
      data: {
        content: null,
        deletedAt: new Date(),
      },
      include: {
        sender: {
          include: { profile: true },
        },
        reads: {
          include: {
            user: {
              include: { profile: true },
            },
          },
        },
        reactions: {
          include: {
            user: {
              include: { profile: true },
            },
          },
        },
      },
    });
  }

  async addMessageReaction(
    userId: string,
    conversationId: string,
    messageId: string,
    type: 'THUMBS_UP' | 'HEART',
  ) {
    await this.ensureLiveSender(userId);
    await this.ensureConversationMembership(userId, conversationId);

    const message = await this.prisma.client.message.findUnique({
      where: { id: messageId },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            penaltyPoints: true,
            globalRole: true,
            isActive: true,
            isBanned: true,
          },
        },
      },
    });

    if (!message || message.conversationId !== conversationId) {
      throw new NotFoundException('message not found');
    }

    if (message.deletedAt) {
      throw new BadRequestException('cannot react to a deleted message');
    }

    if (message.senderId === userId) {
      throw new BadRequestException('you cannot react to your own message');
    }

    const result = await this.prisma.client.$transaction(async (tx) => {
      const existingReaction = await tx.messageReaction.findUnique({
        where: {
          messageId_userId_type: {
            messageId,
            userId,
            type,
          },
        },
      });

      if (existingReaction) {
        return {
          reaction: existingReaction,
          pointsAwarded: 0,
          sender: message.sender,
          senderPromoted: false,
        };
      }

      const reaction = await tx.messageReaction.create({
        data: {
          messageId,
          userId,
          type,
        },
      });

      const updatedSender = await tx.user.update({
        where: { id: message.senderId },
        data: {
          penaltyPoints: {
            increment: this.positiveReactionPointValue,
          },
        },
        select: {
          id: true,
          username: true,
          penaltyPoints: true,
          globalRole: true,
          isActive: true,
          isBanned: true,
        },
      });

      let senderPromoted = false;
      let sender = updatedSender;

      if (
        updatedSender.penaltyPoints >= 500 &&
        updatedSender.globalRole === 'USER' &&
        updatedSender.isActive &&
        !updatedSender.isBanned
      ) {
        sender = await tx.user.update({
          where: { id: updatedSender.id },
          data: { globalRole: 'MODERATOR' },
          select: {
            id: true,
            username: true,
            penaltyPoints: true,
            globalRole: true,
            isActive: true,
            isBanned: true,
          },
        });
        senderPromoted = true;
      }

      return {
        reaction,
        pointsAwarded: this.positiveReactionPointValue,
        sender,
        senderPromoted,
      };
    });

    return {
      ...result,
      messageId,
      conversationId,
    };
  }

  private async ensureLastMessage(
    conversationId: string,
    messageId: string,
    action: 'edit' | 'delete',
  ) {
    const lastMessage = await this.prisma.client.message.findFirst({
      where: {
        conversationId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
      },
    });

    if (!lastMessage || lastMessage.id !== messageId) {
      const verb = action === 'edit' ? 'edited' : 'deleted';
      throw new BadRequestException(`only the last message can be ${verb}`);
    }
  }

  async markConversationRead(
    userId: string,
    conversationId: string,
    messageId?: string,
  ) {
    await this.ensureLiveSender(userId);
    await this.ensureConversationMembership(userId, conversationId);

    let createdBeforeOrAt: Date | undefined;

    if (messageId) {
      const message = await this.prisma.client.message.findUnique({
        where: { id: messageId },
        select: {
          conversationId: true,
          createdAt: true,
        },
      });

      if (!message || message.conversationId !== conversationId) {
        throw new NotFoundException('message not found');
      }

      createdBeforeOrAt = message.createdAt;
    }

    const messages = await this.prisma.client.message.findMany({
      where: {
        conversationId,
        senderId: { not: userId },
        deletedAt: null,
        ...(createdBeforeOrAt && {
          createdAt: { lte: createdBeforeOrAt },
        }),
      },
      select: { id: true },
      take: 500,
    });

    if (messages.length === 0) {
      return {
        conversationId,
        readCount: 0,
      };
    }

    const result = await this.prisma.client.messageRead.createMany({
      data: messages.map((message) => ({
        messageId: message.id,
        userId,
      })),
      skipDuplicates: true,
    });

    return {
      conversationId,
      readCount: result.count,
    };
  }

  async sendMessage(userId: string, conversationId: string, content: string) {
    const sender = await this.ensureLiveSender(userId);
    await this.ensureConversationMembership(userId, conversationId);

    const trimmed = content.trim();

    if (!trimmed) {
      throw new BadRequestException('message content is empty');
    }

    const moderationResult = await this.autoModerationService.analyze(trimmed);

    if (moderationResult.action === 'BLOCK') {
      const message = await this.prisma.client.message.create({
        data: {
          conversationId,
          senderId: userId,
          content: this.automaticModerationPlaceholder,
          type: 'SYSTEM',
        },
        include: {
          sender: {
            include: { profile: true },
          },
          reads: true,
          reactions: true,
        },
      });

      const moderation: ModerationApplyResult =
        await this.autoModerationService.applyBlockedMessage(
          userId,
          trimmed,
          moderationResult,
          message.id,
        );

      const banReason = this.buildAutomaticBanReason(
        moderationResult.categories,
      );

      const banAnnouncementMessage = moderation.penalty.isBanned
        ? await this.prisma.client.message.create({
            data: {
              conversationId,
              senderId: userId,
              content: `automatic moderation ${sender.username} is now bann cause: ${banReason}`,
              type: 'SYSTEM',
            },
            include: {
              sender: {
                include: { profile: true },
              },
              reads: true,
              reactions: true,
            },
          })
        : null;

      await this.prisma.client.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      return {
        ...message,
        moderationWarning: {
          message: 'Your message was deleted by automatic moderation.',
          severity: moderationResult.severity,
          penaltyPointsToSubtract: moderationResult.penaltyPointsToSubtract,
          penaltyPoints: moderation.penalty.penaltyPoints,
          pointsLeftBeforeBan: moderation.penalty.pointsLeftBeforeBan,
          isBanned: moderation.penalty.isBanned,
          banReason,
          categories: moderationResult.categories,
        },
        banAnnouncementMessage,
      };
    }

    const message = await this.prisma.client.message.create({
      data: {
        conversationId,
        senderId: userId,
        content: trimmed,
        type: 'TEXT',
      },
      include: {
        sender: {
          include: { profile: true },
        },
      },
    });

    if (moderationResult.action === 'REPORT') {
      const moderationFlaggedMessage =
        (await this.autoModerationService.applyFlaggedMessage(
          userId,
          message.id,
          trimmed,
          moderationResult,
        )) as unknown as ModerationApplyResult;

      if (moderationFlaggedMessage) {
        const banReason = this.buildAutomaticBanReason(
          moderationResult.categories,
        );
        const banAnnouncementMessage = moderationFlaggedMessage.penalty.isBanned
          ? await this.prisma.client.message.create({
              data: {
                conversationId,
                senderId: userId,
                content: `automatic moderation ${sender.username} is now banned cause: ${banReason}`,
                type: 'SYSTEM',
              },
              include: {
                sender: {
                  include: { profile: true },
                },
                reads: true,
                reactions: true,
              },
            })
          : null;

        await this.prisma.client.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });

        return {
          ...message,
          moderationWarning: {
            message: 'Your message was flagged by automatic moderation.',
            severity: moderationResult.severity,
            penaltyPointsToSubtract: moderationResult.penaltyPointsToSubtract,
            penaltyPoints: moderationFlaggedMessage.penalty.penaltyPoints,
            pointsLeftBeforeBan:
              moderationFlaggedMessage.penalty.pointsLeftBeforeBan,
            isBanned: moderationFlaggedMessage.penalty.isBanned,
            banReason,
            categories: moderationResult.categories,
          },
          banAnnouncementMessage,
        };
      }
    }

    await this.prisma.client.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return message;
  }
}
