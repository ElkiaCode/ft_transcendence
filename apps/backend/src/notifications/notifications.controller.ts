import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.type';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  listMine(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.listMine(user.sub);
  }

  @Patch(':id/read')
  markAsRead(
    @CurrentUser() user: JwtPayload,
    @Param('id') notificationId: string,
  ) {
    return this.notificationsService.markAsRead(user.sub, notificationId);
  }

  @Patch('read-all')
  markAllAsRead(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.markAllAsRead(user.sub);
  }
}