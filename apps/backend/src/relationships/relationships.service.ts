import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatGateway } from '../chat/chat.gateway';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class RelationshipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly chatGateway: ChatGateway,
  ) {}

  private async notifyUser(
    userId: string,
    input: Parameters<NotificationsService['createFromInput']>[1],
  ) {
    const notification = await this.notificationsService.createFromInput(
      userId,
      input,
    );
    this.chatGateway.emitNotificationCreated(userId, notification);
    return notification;
  }

  private async ensureUserExists(userId: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, isActive: true, isBanned: true },
    });

    if (!user) {
      throw new NotFoundException('user not found');
    }

    return user;
  }

  private async ensureUsersCanInteract(
    actorUserId: string,
    targetUserId: string,
  ) {
    if (actorUserId === targetUserId) {
      throw new BadRequestException('you cannot target yourself');
    }

    const [actor, target] = await Promise.all([
      this.ensureUserExists(actorUserId),
      this.ensureUserExists(targetUserId),
    ]);

    if (!actor.isActive || actor.isBanned) {
      throw new BadRequestException('your account cannot perform this action');
    }

    if (!target.isActive || target.isBanned) {
      throw new BadRequestException('target user cannot receive this action');
    }

    return { actor, target };
  }

  private async findBlockBetweenUsers(userA: string, userB: string) {
    return this.prisma.client.block.findFirst({
      where: {
        OR: [
          { blockerId: userA, blockedId: userB },
          { blockerId: userB, blockedId: userA },
        ],
      },
    });
  }

  private async findFriendshipBetweenUsers(userA: string, userB: string) {
    return this.prisma.client.friendship.findFirst({
      where: {
        OR: [
          { requesterId: userA, addresseeId: userB },
          { requesterId: userB, addresseeId: userA },
        ],
      },
    });
  }

  async sendFriendRequest(actorUserId: string, targetUserId: string) {
    const { actor, target } = await this.ensureUsersCanInteract(
      actorUserId,
      targetUserId,
    );

    const existingBlock = await this.findBlockBetweenUsers(
      actorUserId,
      targetUserId,
    );

    if (existingBlock) {
      throw new BadRequestException(
        'friend request not allowed because one user has blocked the other',
      );
    }

    const existingFriendship = await this.findFriendshipBetweenUsers(
      actorUserId,
      targetUserId,
    );

    if (existingFriendship) {
      throw new BadRequestException(
        'friendship or friend request already exists',
      );
    }

    const friendship = await this.prisma.client.friendship.create({
      data: {
        requesterId: actorUserId,
        addresseeId: targetUserId,
        status: 'PENDING',
      },
    });

    await this.notifyUser(targetUserId, {
      type: 'SYSTEM',
      title: 'Friend request received',
      body: `${actor.username} sent you a friend request.`,
      actorId: actorUserId,
      entityType: 'friendship',
      entityId: friendship.id,
      action: 'friend_request_created',
      metadata: {
        requesterId: actorUserId,
        requesterUsername: actor.username,
      },
    });

    return {
      message: 'friend request sent',
      friendship: {
        id: friendship.id,
        requesterId: friendship.requesterId,
        addresseeId: friendship.addresseeId,
        status: friendship.status,
      },
      target: {
        id: target.id,
        username: target.username,
      },
      actor: {
        id: actor.id,
        username: actor.username,
      },
    };
  }

  async acceptFriendRequest(actorUserId: string, requesterUserId: string) {
    await this.ensureUsersCanInteract(actorUserId, requesterUserId);

    const existingBlock = await this.findBlockBetweenUsers(
      actorUserId,
      requesterUserId,
    );

    if (existingBlock) {
      throw new BadRequestException(
        'friend request cannot be accepted because one user has blocked the other',
      );
    }

    const friendship = await this.prisma.client.friendship.findFirst({
      where: {
        requesterId: requesterUserId,
        addresseeId: actorUserId,
        status: 'PENDING',
      },
    });

    if (!friendship) {
      throw new NotFoundException('pending friend request not found');
    }

    const updatedFriendship = await this.prisma.client.friendship.update({
      where: { id: friendship.id },
      data: { status: 'ACCEPTED' },
    });

    const actor = await this.ensureUserExists(actorUserId);

    await this.notifyUser(requesterUserId, {
      type: 'SYSTEM',
      title: 'Friend request accepted',
      body: `${actor.username} accepted your friend request.`,
      actorId: actorUserId,
      entityType: 'friendship',
      entityId: updatedFriendship.id,
      action: 'friend_request_accepted',
      metadata: {
        acceptedByUserId: actorUserId,
        acceptedByUsername: actor.username,
      },
    });

    return {
      message: 'friend request accepted',
      friendship: {
        id: updatedFriendship.id,
        requesterId: updatedFriendship.requesterId,
        addresseeId: updatedFriendship.addresseeId,
        status: updatedFriendship.status,
      },
    };
  }

  async removeFriend(actorUserId: string, targetUserId: string) {
    await this.ensureUsersCanInteract(actorUserId, targetUserId);

    const friendship = await this.findFriendshipBetweenUsers(
      actorUserId,
      targetUserId,
    );

    if (!friendship) {
      throw new NotFoundException('friendship not found');
    }

    const actor = await this.ensureUserExists(actorUserId);

    await this.prisma.client.friendship.delete({
      where: { id: friendship.id },
    });

    await this.notifyUser(targetUserId, {
      type: 'SYSTEM',
      title: 'Friendship removed',
      body: `${actor.username} removed the friendship.`,
      actorId: actorUserId,
      entityType: 'friendship',
      entityId: friendship.id,
      action:
        friendship.status === 'PENDING'
          ? 'friend_request_declined'
          : 'friendship_removed',
      metadata: {
        removedByUserId: actorUserId,
        removedByUsername: actor.username,
        previousStatus: friendship.status,
      },
    });

    return {
      message: 'friendship removed',
      removedFriendshipId: friendship.id,
    };
  }

  async getIncomingFriendRequests(userId: string) {
    const request = await this.prisma.client.friendship.findMany({
      where: {
        status: 'PENDING',
        addresseeId: userId,
      },
      include: {
        requester: {
          include: { profile: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return request.map((request) => ({
      friendshipId: request.id,
      createdAt: request.createdAt,
      user: {
        id: request.requester.id,
        username: request.requester.username,
        displayName:
          request.requester.profile?.displayName ?? request.requester.username,
        avatarUrl: request.requester.profile?.avatarUrl ?? null,
      },
    }));
  }

  async getOutGoingFriendRequests(userId: string) {
    const request = await this.prisma.client.friendship.findMany({
      where: {
        status: 'PENDING',
        requesterId: userId,
      },
      include: {
        addressee: {
          include: { profile: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return request.map((request) => ({
      FriendshiptId: request.id,
      createdAt: request.createdAt,
      user: {
        id: request.addressee.id,
        username: request.addressee.username,
        displayName:
          request.addressee.profile?.displayName ?? request.addressee.username,
        avatarUrl: request.addressee.profile?.avatarUrl ?? null,
      },
    }));
  }

  async blockUser(actorUserId: string, targetUserId: string) {
    const { actor } = await this.ensureUsersCanInteract(
      actorUserId,
      targetUserId,
    );

    const existingBlock = await this.prisma.client.block.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: actorUserId,
          blockedId: targetUserId,
        },
      },
    });

    if (existingBlock) {
      throw new BadRequestException('user is already blocked');
    }

    const friendship = await this.findFriendshipBetweenUsers(
      actorUserId,
      targetUserId,
    );

    const [block] = await this.prisma.client.$transaction([
      this.prisma.client.block.create({
        data: {
          blockerId: actorUserId,
          blockedId: targetUserId,
        },
      }),
      ...(friendship
        ? [
            this.prisma.client.friendship.delete({
              where: { id: friendship.id },
            }),
          ]
        : []),
    ]);

    await this.notifyUser(targetUserId, {
      type: 'SYSTEM',
      title: 'User blocked you',
      body: `${actor.username} blocked you.`,
      actorId: actorUserId,
      entityType: 'block',
      entityId: block.id,
      action: 'user_blocked',
      metadata: {
        blockerId: actorUserId,
        blockerUsername: actor.username,
        friendshipRemoved: Boolean(friendship),
      },
    });

    return {
      message: 'user blocked',
      block: {
        id: block.id,
        blockerId: block.blockerId,
        blockedId: block.blockedId,
      },
      friendshipRemoved: Boolean(friendship),
    };
  }

  async unblockUser(actorUserId: string, targetUserId: string) {
    const { actor } = await this.ensureUsersCanInteract(
      actorUserId,
      targetUserId,
    );

    const block = await this.prisma.client.block.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: actorUserId,
          blockedId: targetUserId,
        },
      },
    });

    if (!block) {
      throw new NotFoundException('block not found');
    }

    await this.prisma.client.block.delete({
      where: {
        blockerId_blockedId: {
          blockerId: actorUserId,
          blockedId: targetUserId,
        },
      },
    });

    await this.notifyUser(targetUserId, {
      type: 'SYSTEM',
      title: 'User unblocked you',
      body: `${actor.username} unblocked you.`,
      actorId: actorUserId,
      entityType: 'block',
      entityId: block.id,
      action: 'user_unblocked',
      metadata: {
        blockerId: actorUserId,
        blockerUsername: actor.username,
      },
    });

    return {
      message: 'user unblocked',
      unblockedUserId: targetUserId,
    };
  }
}
