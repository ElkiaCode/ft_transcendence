import { Controller, Get, Post, Body, UseGuards, Patch, UploadedFile, UseInterceptors, Query, Param } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { EraseMyDataDto } from 'src/auth/dto/erase-my-data.dto';
import { UpdateProfileDto } from './dto/dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: JwtPayload) {
    return this.usersService.getMe(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('friends')
  getAcceptedFriends(@CurrentUser() user: JwtPayload) { 
    return this.usersService.getMyFriends(user.sub)
  }

  @UseGuards(JwtAuthGuard)
  @Get('search')
  searchUsers(
    @CurrentUser() user: JwtPayload,
    @Query('q') q: string,
  ) {
    return this.usersService.searchUsers(user.sub, q);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('update/profile')
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('update/avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.usersService.updateAvatar(user.sub, file);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/erase-data')
  eraseMyData(
    @CurrentUser() user: JwtPayload,
    @Body() dto: EraseMyDataDto,
  ) {
    return this.usersService.eraseMyData(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':username')
  getUserByUsername(@Param('username') username: string) {
    return this.usersService.getUserByUsername(username);
  }
}

