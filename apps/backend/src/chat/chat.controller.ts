import { Body, Controller, Get, Param, Post, Patch, UseGuards } from '@nestjs/common';
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
}