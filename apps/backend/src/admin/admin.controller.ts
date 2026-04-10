import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.type';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('users/:id/ban')
  @Roles('ADMIN', 'MODERATOR')
  banUser(
    @Param('id') id: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.adminService.banUser(id, actor.sub);
  }

  @Post('users/:id/unban')
  @Roles('ADMIN', 'MODERATOR')
  unbanUser(
    @Param('id') id: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.adminService.unbanUser(id, actor.sub);
  }
}