import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { SendMessageDto } from './dto/send-message.dto';

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