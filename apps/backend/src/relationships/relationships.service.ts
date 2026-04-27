import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FriendshipStatus } from 'src/generated/prisma';

@Injectable()
export class RelationshipsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, isActive: true, isBanned: true },
    });

    if (!user) {
      throw new NotFoundException('user not found');
    }

    return user;
  }

  private async ensureUsersCanInteract(actorUserId: string, targetUserId: string) {
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
    return this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: userA, blockedId: userB },
          { blockerId: userB, blockedId: userA },
        ],
      },
    });
  }

  private async findFriendshipBetweenUsers(userA: string, userB: string) {
    return this.prisma.friendship.findFirst({
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
      throw new BadRequestException('friend request not allowed because one user has blocked the other');
    }

    const existingFriendship = await this.findFriendshipBetweenUsers(
      actorUserId,
      targetUserId,
    );

    if (existingFriendship) {
      throw new BadRequestException('friendship or friend request already exists');
    }

    const friendship = await this.prisma.friendship.create({
      data: {
        requesterId: actorUserId,
        addresseeId: targetUserId,
        status: 'PENDING',
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
      throw new BadRequestException('friend request cannot be accepted because one user has blocked the other');
    }

    const friendship = await this.prisma.friendship.findFirst({
      where: {
        requesterId: requesterUserId,
        addresseeId: actorUserId,
        status: 'PENDING',
      },
    });

    if (!friendship) {
      throw new NotFoundException('pending friend request not found');
    }

    const updatedFriendship = await this.prisma.friendship.update({
      where: { id: friendship.id },
      data: { status: 'ACCEPTED' },
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

    await this.prisma.friendship.delete({
      where: { id: friendship.id },
    });

    return {
      message: 'friendship removed',
      removedFriendshipId: friendship.id,
    };
  }

  async getIncomingFriendRequests(userId: string) {
    const request = await this.prisma.friendship.findMany({
      where: {
        status: 'PENDING',
        addresseeId: userId
      },
      include: {
        requester: {
          include: { profile: true },
        },
      },
      orderBy: { createdAt: 'desc' }
    });

    return request.map((request) => ({
      friendshipId: request.id,
      createdAt: request.createdAt,
      user: {
        id: request.requester.id,
        username: request.requester.username,
        displayName: request.requester.profile?.displayName ?? request.requester.username,
        avatarUrl: request.requester.profile?.avatarUrl ?? null
      }
    }))
  }

  async getOutGoingFriendRequests(userId: string) {
    const request = await this.prisma.friendship.findMany({
      where: {
        status: 'PENDING',
        requesterId: userId
      },
      include: {
        addressee: {
          include: { profile: true },
        },
      },
      orderBy: { createdAt: 'desc' }
    });

    return request.map((request) => ({
      FriendshiptId: request.id,
      createdAt: request.createdAt,
      user: {
        id: request.addressee.id,
        username: request.addressee.username,
        displayName: request.addressee.profile?.displayName ?? request.addressee.username,
        avatarUrl: request.addressee.profile?.avatarUrl ?? null
      }
    }))
  }

  async blockUser(actorUserId: string, targetUserId: string) {
    await this.ensureUsersCanInteract(actorUserId, targetUserId);

    const existingBlock = await this.prisma.block.findUnique({
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

    const [block] = await this.prisma.$transaction([
      this.prisma.block.create({
        data: {
          blockerId: actorUserId,
          blockedId: targetUserId,
        },
      }),
      ...(friendship
        ? [
            this.prisma.friendship.delete({
              where: { id: friendship.id },
            }),
          ]
        : []),
    ]);

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
    await this.ensureUsersCanInteract(actorUserId, targetUserId);

    const block = await this.prisma.block.findUnique({
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

    await this.prisma.block.delete({
      where: {
        blockerId_blockedId: {
          blockerId: actorUserId,
          blockedId: targetUserId,
        },
      },
    });

    return {
      message: 'user unblocked',
      unblockedUserId: targetUserId,
    };
  }
}