import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InviteUsersDto } from './dto/invite-users.dto';
import { CreateGroupConversationDto } from './dto/create-group-conversation.dto';
import { AutoModerationService } from '../moderation/auto-moderation.service';

@Injectable()
export class ChatService {
  private readonly positiveReactionPointValue = 5;
<<<<<<< HEAD
  private readonly automaticModerationPlaceholder = 'message deleted by automatic moderation';
=======
  private readonly automaticModerationPlaceholder =
    'message deleted by automatic moderation';
>>>>>>> main

  constructor(
    private readonly prisma: PrismaService,
    private readonly autoModerationService: AutoModerationService,
  ) {}

  private async ensureGroupConversationExists(conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
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
    const membership = await this.prisma.conversationParticipant.findUnique({
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
    const users = await this.prisma.user.findMany({
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

      const block = await this.prisma.block.findFirst({
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
    const menbership = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId: actorUserId } },
      include: { conversation: true },
    });

    if (!menbership) {
      throw new ForbiddenException(
        'You are not a participant of this conversation',
      );
    }

    if (menbership.conversation.type !== 'GROUP') {
      throw new BadRequestException(
        'You can only invite users to a group conversation',
      );
    }

    /*if (menbership.role !== 'OWNER' && menbership.role !== 'ADMIN') {
      throw new ForbiddenException('only room owner or admin can invite users');
    }*/

    return menbership;
  }

  async getOtherParticipantIds(conversationId: string, currentUserId: string) {
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { userId: true },
    });

    return participants
      .map((p) => p.userId)
      .filter((id) => id !== currentUserId);
  }

  private async ensureLiveSender(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

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
    const user = await this.prisma.user.findUnique({
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
      this.prisma.block.findFirst({
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
    const membership = await this.prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId,
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'you are not a participant of this conversation',
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
    await this.ensureCanDirectMessage(actorUserId, targetUserId);

    const existing = await this.prisma.conversation.findFirst({
      where: {
        type: 'DIRECT',
        AND: [
          { participants: { some: { userId: actorUserId } } },
          { participants: { some: { userId: targetUserId } } },
        ],
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

    if (existing) {
      return existing;
    }

    return this.prisma.conversation.create({
      data: {
        type: 'DIRECT',
        participants: {
          create: [
            { userId: actorUserId, role: 'OWNER' },
            { userId: targetUserId, role: 'OWNER' },
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
  }

  async createGroupeConversation(
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

    const conversation = await this.prisma.conversation.create({
      data: {
        type: 'GROUP',
        title: dto.title?.trim() || null,
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

    const existingParticipants =
      await this.prisma.conversationParticipant.findMany({
        where: {
          conversationId,
          userId: { in: normalizedUserIds },
        },
        select: {
          userId: true,
        },
      });

    const existingUserIds = new Set(existingParticipants.map((p) => p.userId));

    const newUserIds = normalizedUserIds.filter(
      (id) => !existingUserIds.has(id),
    );

    if (newUserIds.length === 0) {
      return {
        message: 'all selected users are already in the conversation',
        invitedCount: 0,
        invitedUserIds: [],
        conversation: null,
      };
    }

    await this.prisma.$transaction([
      this.prisma.conversationParticipant.createMany({
        data: newUserIds.map((userId) => ({
          conversationId,
          userId,
          role: 'MEMBER',
        })),
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
    ]);

    const conversation = await this.prisma.conversation.findUnique({
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
      invitedCount: newUserIds.length,
      invitedUserIds: newUserIds,
      conversation,
    };
  }

  async removeUserFromGroup(
    actorUserId: string,
    conversationId: string,
    targetUserId: string,
  ) {
    await this.ensureLiveSender(actorUserId);
    const actorMenbership = await this.ensureGroupManagementPermission(
      actorUserId,
      conversationId,
    );

    if (actorUserId === targetUserId) {
      throw new BadRequestException(
        'To quit the group click on the leave option',
      );
    }

    const targetMenbership =
      await this.prisma.conversationParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId,
            userId: targetUserId,
          },
        },
      });

    if (!targetMenbership) {
      throw new NotFoundException('target user is not in this conversation');
    }

    if (targetMenbership.role === 'OWNER' && actorMenbership.role !== 'OWNER') {
      throw new ForbiddenException(
        'only the room owner can remove another user',
      );
    }

    const remainingParticipantsCount =
      await this.prisma.conversationParticipant.count({
        where: { conversationId },
      });

    if (remainingParticipantsCount <= 1) {
      throw new BadRequestException('cannot remove the last participant');
    }

    await this.prisma.$transaction([
      this.prisma.conversationParticipant.delete({
        where: {
          conversationId_userId: {
            conversationId,
            userId: targetUserId,
          },
        },
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
    ]);

    return {
      message: 'user removed from group',
      removedUserId: targetUserId,
      conversationId,
      conversationTitle: actorMenbership.conversation.title ?? 'Group chat',
    };
  }

  async leaveConversation(userId: string, conversationId: string) {
    await this.ensureLiveSender(userId);

    const membership = await this.prisma.conversationParticipant.findUnique({
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

    const participants = await this.prisma.conversationParticipant.findMany({
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

    await this.prisma.$transaction(async (tx) => {
      await tx.conversationParticipant.delete({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
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

    const conversation = await this.prisma.conversation.update({
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
    const conversations = await this.prisma.conversation.findMany({
      where: {
        participants: {
          some: { userId },
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
      const otherUser = conv.participants.find(
        (p) => p.userId !== userId,
      )?.user;

      const lastMessage = conv.messages[0];

      return {
        id: conv.id,
        type: conv.type === 'DIRECT' ? 'dm' : 'group',

<<<<<<< HEAD
      name:
        conv.type === 'DIRECT'
          ? otherUser?.username
          : conv.title ?? 'Group chat',
=======
        name:
          conv.type === 'DIRECT'
            ? otherUser?.username
            : (conv.title ?? 'Group chat'),
>>>>>>> main

        avatarUrl:
          conv.type === 'DIRECT'
            ? (otherUser?.profile?.avatarUrl ?? null)
            : null,

        lastMessage: lastMessage?.content ?? null,

        unreadCount: 0,
      };
    });
  }

  async listMessages(userId: string, conversationId: string) {
    await this.ensureConversationMembership(userId, conversationId);

    return this.prisma.message.findMany({
      where: { conversationId },
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
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  }

  async listMembers(userId: string, conversationId: string) {
    await this.ensureConversationMembership(userId, conversationId);

    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
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

    const message = await this.prisma.message.findUnique({
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

    return this.prisma.message.update({
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

    const message = await this.prisma.message.findUnique({
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

    return this.prisma.message.update({
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

    const message = await this.prisma.message.findUnique({
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

    const result = await this.prisma.$transaction(async (tx) => {
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
    const lastMessage = await this.prisma.message.findFirst({
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
      const message = await this.prisma.message.findUnique({
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

    const messages = await this.prisma.message.findMany({
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

    const result = await this.prisma.messageRead.createMany({
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
      const message = await this.prisma.message.create({
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

      const moderation = await this.autoModerationService.applyBlockedMessage(
        userId,
        trimmed,
        moderationResult,
        message.id,
      );
<<<<<<< HEAD
      const banReason = this.buildAutomaticBanReason(moderationResult.categories);
=======
      const banReason = this.buildAutomaticBanReason(
        moderationResult.categories,
      );
>>>>>>> main
      const banAnnouncementMessage = moderation.penalty.isBanned
        ? await this.prisma.message.create({
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

      await this.prisma.conversation.update({
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

    const message = await this.prisma.message.create({
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
      const moderation = await this.autoModerationService.applyFlaggedMessage(
        userId,
        message.id,
        trimmed,
        moderationResult,
      );

      if (moderation) {
<<<<<<< HEAD
        const banReason = this.buildAutomaticBanReason(moderationResult.categories);
=======
        const banReason = this.buildAutomaticBanReason(
          moderationResult.categories,
        );
>>>>>>> main
        const banAnnouncementMessage = moderation.penalty.isBanned
          ? await this.prisma.message.create({
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

        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });

        return {
          ...message,
          moderationWarning: {
            message: 'Your message was flagged by automatic moderation.',
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
    }

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return message;
  }
}
