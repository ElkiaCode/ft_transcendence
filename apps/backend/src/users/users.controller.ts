import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Patch,
  UploadedFile,
  UseInterceptors,
  Query,
  Param,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { EraseMyDataDto } from '../auth/dto/erase-my-data.dto';
import { UpdateProfileDto } from './dto/dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { ConfirmDataErasureDto } from './dto/confirm-data-erasure.dto';
import { clearRefreshCookie } from '../auth/utils/refresh-cookie.util';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: JwtPayload) {
    return this.usersService.getMe(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/export-data')
  exportMyData(@CurrentUser() user: JwtPayload) {
    return this.usersService.exportMyData(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('friends')
  getAcceptedFriends(@CurrentUser() user: JwtPayload) {
    return this.usersService.getMyFriends(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('search')
  searchUsers(@CurrentUser() user: JwtPayload, @Query('q') q: string) {
    return this.usersService.searchUsers(user.sub, q);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MODERATOR')
  @Get('admin/search')
  searchUsersAdmin(@Query('q') q: string) {
    return this.usersService.searchUsersAdmin(q);
  }

  @UseGuards(JwtAuthGuard)
  @Get('top-positive-points')
  getTopPositivePointUsers() {
    return this.usersService.getTopPositivePointUsers();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/points')
  getMyPoints(@CurrentUser() user: JwtPayload) {
    return this.usersService.getMyPoints(user.sub);
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
  requestDataErasure(
    @CurrentUser() user: JwtPayload,
    @Body() dto: EraseMyDataDto,
  ) {
    return this.usersService.requestDataErasure(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/confirm-data-erasure')
  async confirmDataErasure(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ConfirmDataErasureDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.usersService.confirmDataErasure(
      user.sub,
      dto.token,
      dto.currentPassword,
    );

    clearRefreshCookie(response);
    response.clearCookie('access_token');

    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Patch('update/password')
  async updatePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdatePasswordDto,
  ) {
    return this.usersService.updatePassword(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':username')
  getUserByUsername(@Param('username') username: string) {
    return this.usersService.getUserByUsername(username);
  }
}
