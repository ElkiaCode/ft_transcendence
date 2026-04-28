import { Body, Controller, Delete, Get, Param, Post, Patch, UseGuards } from '@nestjs/common';
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

  @Post('direct/:userId')
  createOrGetDirectConversation(
    @CurrentUser() user: JwtPayload,
    @Param('userId') targetUserId: string,
  ) {
    return this.chatService.createOrGetDirectConversation(user.sub, targetUserId);
  }

  @Post('group')
  createGroupeConversation(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateGroupConversationDto,
  ) {
    return this.chatService.createGroupeConversation(user.sub, dto);
  }

  @Post('conversation/:conversationId/invite')
  inviteUsers(
    @CurrentUser() user: JwtPayload,
    @Param('conversationId') conversationId: string,
    @Body() dto: InviteUsersDto,
  ) {
    return this.chatService.inviteUsers(user.sub, conversationId, dto);
  }

  @Post('conversation/:conversationId/remove-user/:userId')
  removeUserFromGroup(
    @CurrentUser() user: JwtPayload,
    @Param('conversationId') conversationId: string,
    @Param('userId') userId: string
  ) {
    return this.chatService.removeUserFromGroup(user.sub, conversationId, userId);
  }

  @Post('conversation/:conversationId/leave')
  leaveConversation(
    @CurrentUser() user: JwtPayload,
    @Param('conversationId') conversationId: string
  ) {
    return this.chatService.leaveConversation(user.sub, conversationId);
  }

  @Patch('conversation/:conversationId/rename')
  renameConversation(
    @CurrentUser() user: JwtPayload,
    @Param('conversationId') conversationId: string,
    @Body() dto: RenameConversationDto
  ) {
    return this.chatService.renameConversation(user.sub, conversationId, dto.title);
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

    const recipientIds = await this.chatService.getOtherParticipantIds(
      conversationId,
      user.sub,
    );

    const preview =
      dto.content.trim().length > 80
        ? `${dto.content.trim().slice(0, 80)}…`
        : dto.content.trim();

    const notifications = await this.notificationsService.createForMany(
      recipientIds,
      'MESSAGE',
      'New message',
      preview,
    );

    for (const notification of notifications) {
      await this.chatGateway.emitNotificationCreated(
        notification.userId,
        notification,
      );
    }

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

    return message;
  }

  @Post('conversations/:conversationId/messages/:messageId/reactions')
  addMessageReaction(
    @CurrentUser() user: JwtPayload,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
    @Body() dto: AddMessageReactionDto,
  ) {
    return this.chatService.addMessageReaction(
      user.sub,
      conversationId,
      messageId,
      dto.type,
    );
  }
}
