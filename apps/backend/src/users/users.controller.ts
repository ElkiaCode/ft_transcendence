import { Controller, Patch, UploadedFile, UseInterceptors, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import * as multer from 'multer';
import { UsersService } from './users.service';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { id: string; email?: string; username?: string };
}

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Patch('me/avatar')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadAvatar(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: any,
  ) {
    const userId = req.user.id;
    return this.usersService.update(userId, {}, file);
  }
}