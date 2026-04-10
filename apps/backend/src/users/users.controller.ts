import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { EraseMyDataDto } from 'src/auth/dto/erase-my-data.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: JwtPayload) {
    return this.usersService.getMe(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/erase-data')
  eraseMyData(
    @CurrentUser() user: JwtPayload,
    @Body() dto: EraseMyDataDto,
  ) {
    return this.usersService.eraseMyData(user.sub, dto);
  }
}