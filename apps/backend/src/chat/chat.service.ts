import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

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

  private async ensureCanDirectMessage(actorUserId: string, targetUserId: string) {
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

  private async ensureConversationMembership(userId: string, conversationId: string) {
    const membership = await this.prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId,
      },
    });

    if (!membership) {
      throw new ForbiddenException('you are not a participant of this conversation');
    }

    return membership;
  }

  async createOrGetDirectConversation(actorUserId: string, targetUserId: string) {
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
      (p) => p.userId !== userId
    )?.user;

    const lastMessage = conv.messages[0];

    return {
      id: conv.id,
      type: conv.type === 'DIRECT' ? 'dm' : 'group',

      name:
        conv.type === 'DIRECT'
          ? otherUser?.username
          : 'Group chat',

      avatarUrl:
        conv.type === 'DIRECT'
          ? otherUser?.profile?.avatarUrl ?? null
          : null,

      lastMessage: lastMessage?.content ?? null,

      unreadCount: 0, // 👉 tu feras ça plus tard
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
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  }

  async sendMessage(userId: string, conversationId: string, content: string) {
    await this.ensureLiveSender(userId);
    await this.ensureConversationMembership(userId, conversationId);

    const trimmed = content.trim();

    if (!trimmed) {
      throw new BadRequestException('message content is empty');
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

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return message;
  }
}