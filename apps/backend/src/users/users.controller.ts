import { Controller, Get, Post, Body, UseGuards, Patch, UploadedFile, UseInterceptors, Req, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { EraseMyDataDto } from 'src/auth/dto/erase-my-data.dto';
import { UpdateProfileDto } from './dto/dto';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { id: string; email?: string; username?: string };
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: JwtPayload) {
    return this.usersService.getMe(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('search')
  searchUsers(
    @CurrentUser() user: JwtPayload,
    @Query('q') q: string,
  ) {
    return this.usersService.searchUsers(user.sub, q);
  }

  @Patch('update/profile')
  async updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(req.user.id, dto);
  }

  @Patch('update/avatar')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadAvatar(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: any,
  ) {
    return this.usersService.updateAvatar(req.user.id, file);
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

