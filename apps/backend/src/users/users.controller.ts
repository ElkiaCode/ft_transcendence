import {
  Controller,
  Patch,
  Body,
  UploadedFile,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/dto';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { id: string; email?: string; username?: string };
}

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Patch('me')
  async updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(req.user.id, dto);
  }

  @Patch('me/avatar')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadAvatar(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: any,
  ) {
    return this.usersService.updateAvatar(req.user.id, file);
  }
}
