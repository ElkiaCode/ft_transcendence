import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { SendMessageDto } from './dto/send-message.dto';
import { CreateGroupConversationDto } from './dto/create-group-conversation.dto';
import { InviteUsersDto } from './dto/invite-users.dto';
import { RenameConversationDto } from './dto/rename-conversation.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import { AddMessageReactionDto } from './dto/add-message-reaction.dto';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async notifyUser(
    userId: string,
    input: Parameters<NotificationsService['createFromInput']>[1],
  ) {
    const notification = await this.notificationsService.createFromInput(
      userId,
      input,
    );
    await this.chatGateway.emitNotificationCreated(userId, notification);
    return notification;
  }

  private async notifyUsers(
    userIds: string[],
    input: Parameters<NotificationsService['createFromInput']>[1],
  ) {
    const uniqueUserIds = [...new Set(userIds)];
    const notifications =
      await this.notificationsService.createFromInputForMany(
        uniqueUserIds,
        input,
      );

    for (const notification of notifications) {
      await this.chatGateway.emitNotificationCreated(
        notification.userId,
        notification,
      );
    }

    return notifications;
  }

  @Post('direct/:userId')
  createOrGetDirectConversation(
    @CurrentUser() user: JwtPayload,
    @Param('userId') targetUserId: string,
  ) {
    return this.chatService.createOrGetDirectConversation(
      user.sub,
      targetUserId,
    );
  }

  @Post('group')
  async createGroupConversation(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateGroupConversationDto,
  ) {
    const result = await this.chatService.createGroupConversation(
      user.sub,
      dto,
    );
    const conversation = result.conversation;
    const groupName = conversation.title ?? 'Group chat';
    const recipientIds = conversation.participants
      .map((participant) => participant.userId)
      .filter((userId) => userId !== user.sub);

    await this.notifyUsers(recipientIds, {
      type: 'SYSTEM',
      title: 'Added to group',
      body: `${user.username} added you to ${groupName}.`,
      actorId: user.sub,
      entityType: 'conversation',
      entityId: conversation.id,
      action: 'group_created',
      metadata: {
        conversationId: conversation.id,
        groupName,
        creatorUsername: user.username,
      },
    });

    return result;
  }

  @Post('conversation/:conversationId/invite')
  async inviteUsers(
    @CurrentUser() user: JwtPayload,
    @Param('conversationId') conversationId: string,
    @Body() dto: InviteUsersDto,
  ) {
    const result = await this.chatService.inviteUsers(
      user.sub,
      conversationId,
      dto,
    );
    const groupName = result.conversation?.title ?? 'Group chat';

    if (result.invitedUserIds?.length) {
      await this.notifyUsers(result.invitedUserIds, {
        type: 'SYSTEM',
        title: 'Group invitation',
        body: `${user.username} added you to ${groupName}.`,
        actorId: user.sub,
        entityType: 'conversation',
        entityId: conversationId,
        action: 'group_members_invited',
        metadata: {
          conversationId,
          groupName,
          invitedByUsername: user.username,
        },
      });
    }

    return result;
  }

  @Post('conversation/:conversationId/remove-user/:userId')
  async removeUserFromGroup(
    @CurrentUser() user: JwtPayload,
    @Param('conversationId') conversationId: string,
    @Param('userId') userId: string,
  ) {
    const result = await this.chatService.removeUserFromGroup(
      user.sub,
      conversationId,
      userId,
    );

    await this.notifyUser(userId, {
      type: 'SYSTEM',
      title: 'Removed from group',
      body: `${user.username} removed you from ${result.conversationTitle}.`,
      actorId: user.sub,
      entityType: 'conversation',
      entityId: conversationId,
      action: 'group_member_removed',
      metadata: {
        conversationId,
        groupName: result.conversationTitle,
        removedByUsername: user.username,
      },
    });

    return result;
  }

  @Post('conversation/:conversationId/leave')
  async leaveConversation(
    @CurrentUser() user: JwtPayload,
    @Param('conversationId') conversationId: string,
  ) {
    const result = await this.chatService.leaveConversation(
      user.sub,
      conversationId,
    );

    await this.notifyUsers(result.remainingUserIds, {
      type: 'SYSTEM',
      title: 'Member left group',
      body: `${user.username} left ${result.conversationTitle}.`,
      actorId: user.sub,
      entityType: 'conversation',
      entityId: conversationId,
      action: 'group_member_left',
      metadata: {
        conversationId,
        groupName: result.conversationTitle,
        previousRole: result.previousRole,
        nextOwnerId: result.nextOwnerId,
      },
    });

    if (result.nextOwnerId) {
      await this.notifyUser(result.nextOwnerId, {
        type: 'SYSTEM',
        title: 'You are now group owner',
        body: `Ownership of ${result.conversationTitle} was transferred to you.`,
        actorId: user.sub,
        entityType: 'conversation',
        entityId: conversationId,
        action: 'group_owner_transferred',
        metadata: {
          conversationId,
          groupName: result.conversationTitle,
          previousOwnerUsername: user.username,
        },
      });
    }

    return result;
  }

  @Patch('conversation/:conversationId/rename')
  async renameConversation(
    @CurrentUser() user: JwtPayload,
    @Param('conversationId') conversationId: string,
    @Body() dto: RenameConversationDto,
  ) {
    const result = await this.chatService.renameConversation(
      user.sub,
      conversationId,
      dto.title,
    );
    const recipientIds = await this.chatService.getOtherParticipantIds(
      conversationId,
      user.sub,
    );

    await this.notifyUsers(recipientIds, {
      type: 'SYSTEM',
      title: 'Group renamed',
      body: `${user.username} renamed the group to ${result.conversation.title}.`,
      actorId: user.sub,
      entityType: 'conversation',
      entityId: conversationId,
      action: 'group_renamed',
      metadata: {
        conversationId,
        groupName: result.conversation.title ?? 'Group chat',
        renamedByUsername: user.username,
      },
    });

    return result;
  }

  @Get('conversations')
  listMyConversations(@CurrentUser() user: JwtPayload) {
    return this.chatService.listMyConversations(user.sub);
  }

  @Get('conversations/:conversationId/messages')
  listMessages(
    @CurrentUser() user: JwtPayload,
    @Param('conversationId') conversationId: string,
  ) {
    return this.chatService.listMessages(user.sub, conversationId);
  }

  @Get('conversations/:conversationId/members')
  listMembers(
    @CurrentUser() user: JwtPayload,
    @Param('conversationId') conversationId: string,
  ) {
    return this.chatService.listMembers(user.sub, conversationId);
  }

  @Post('conversations/:conversationId/read')
  async markConversationRead(
    @CurrentUser() user: JwtPayload,
    @Param('conversationId') conversationId: string,
    @Body() dto: MarkReadDto,
  ) {
    const result = await this.chatService.markConversationRead(
      user.sub,
      conversationId,
      dto.messageId,
    );

    await this.chatGateway.emitConversationRead(conversationId, {
      userId: user.sub,
      conversationId,
      messageId: dto.messageId ?? null,
      readCount: result.readCount,
    });

    return result;
  }

  @Post('conversations/:conversationId/messages')
  async sendMessage(
    @CurrentUser() user: JwtPayload,
    @Param('conversationId') conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    const message = await this.chatService.sendMessage(
      user.sub,
      conversationId,
      dto.content,
    );

    await this.chatGateway.emitMessageCreated(conversationId, message);

    if ((message as any).banAnnouncementMessage) {
      await this.chatGateway.emitMessageCreated(
        conversationId,
        (message as any).banAnnouncementMessage,
      );
    }

    if ((message as any).moderationWarning) {
      await this.chatGateway.emitModerationWarning(
        user.sub,
        (message as any).moderationWarning,
      );

      if ((message as any).moderationWarning.isBanned) {
        await this.chatGateway.emitModerationBanAndDisconnect(user.sub, {
          message: 'Your account was banned by automatic moderation.',
          reason:
            (message as any).moderationWarning.banReason ?? 'harmful message',
          penaltyPoints: (message as any).moderationWarning.penaltyPoints,
        });
      }
    }

    const recipientIds = await this.chatService.getOtherParticipantIds(
      conversationId,
      user.sub,
    );

    const messageContent = message.content ?? 'New message';
    const preview =
      messageContent.trim().length > 80
        ? `${messageContent.trim().slice(0, 80)}…`
        : messageContent.trim();

    await this.notifyUsers(recipientIds, {
      type: 'MESSAGE',
      title: 'New message',
      body: preview,
      actorId: user.sub,
      entityType: 'message',
      entityId: message.id,
      action: 'message_created',
      metadata: {
        conversationId,
        senderUsername: user.username,
      },
    });

    return message;
  }

  @Patch('conversations/:conversationId/messages/:messageId')
  async editMessage(
    @CurrentUser() user: JwtPayload,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
    @Body() dto: EditMessageDto,
  ) {
    const message = await this.chatService.editMessage(
      user.sub,
      conversationId,
      messageId,
      dto.content,
    );

    await this.chatGateway.emitMessageUpdated(conversationId, message);

    const recipientIds = await this.chatService.getOtherParticipantIds(
      conversationId,
      user.sub,
    );

    await this.notifyUsers(recipientIds, {
      type: 'MESSAGE',
      title: 'Message edited',
      body: `${user.username} edited a message.`,
      actorId: user.sub,
      entityType: 'message',
      entityId: message.id,
      action: 'message_updated',
      metadata: {
        conversationId,
        senderUsername: user.username,
      },
    });

    return message;
  }

  @Delete('conversations/:conversationId/messages/:messageId')
  async deleteMessage(
    @CurrentUser() user: JwtPayload,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
  ) {
    const message = await this.chatService.deleteMessage(
      user.sub,
      conversationId,
      messageId,
    );

    await this.chatGateway.emitMessageDeleted(conversationId, message);

    const recipientIds = await this.chatService.getOtherParticipantIds(
      conversationId,
      user.sub,
    );

    await this.notifyUsers(recipientIds, {
      type: 'MESSAGE',
      title: 'Message deleted',
      body: `${user.username} deleted a message.`,
      actorId: user.sub,
      entityType: 'message',
      entityId: message.id,
      action: 'message_deleted',
      metadata: {
        conversationId,
        senderUsername: user.username,
      },
    });

    return message;
  }

  @Post('conversations/:conversationId/messages/:messageId/reactions')
  async addMessageReaction(
    @CurrentUser() user: JwtPayload,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
    @Body() dto: AddMessageReactionDto,
  ) {
    const result = await this.chatService.addMessageReaction(
      user.sub,
      conversationId,
      messageId,
      dto.type,
    );

    if (result.pointsAwarded > 0) {
      await this.notifyUser(result.sender.id, {
        type: 'SYSTEM',
        title: 'New reaction',
        body: `${user.username} reacted to your message.`,
        actorId: user.sub,
        entityType: 'message',
        entityId: messageId,
        action: 'message_reaction_created',
        metadata: {
          conversationId,
          reactionType: dto.type,
          pointsAwarded: result.pointsAwarded,
        },
      });
    }

    if (result.senderPromoted) {
      await this.notifyUser(result.sender.id, {
        type: 'SYSTEM',
        title: 'Role updated',
        body: 'You were promoted to moderator after earning enough points.',
        actorId: user.sub,
        entityType: 'user',
        entityId: result.sender.id,
        action: 'user_auto_promoted',
        metadata: {
          newRole: result.sender.globalRole,
          penaltyPoints: result.sender.penaltyPoints,
        },
      });
    }

    return result;
  }
}
