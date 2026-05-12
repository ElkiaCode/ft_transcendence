import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AutoModerationService } from '../moderation/auto-moderation.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, AutoModerationService],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
