import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { ChatModule } from '../chat/chat.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersBootstrapDev } from './bootstrap/users.bootstrap';
import { AuthModule } from '@/auth/auth.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    AuthModule,
    ChatModule,
    MailModule,
    NotificationsModule,
    MulterModule.register({
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const filename = `${Date.now()}-${file.originalname}`;
          cb(null, filename);
        },
      }),
    }),
  ],
  controllers: [UsersController],
  providers: [UsersBootstrapDev, UsersService],
})
export class UsersModule {}
