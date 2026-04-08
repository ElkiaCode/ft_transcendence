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
	const userId = 'test-user-1'; // TODO: test
    return this.usersService.updateProfile(userId, dto); // TODO: replace userId with req.user.id when JWT guard is ready
  }

  @Patch('me/avatar')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadAvatar(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: any,
  ) {
	const userId = 'test-user-1'; // TODO: test
    return this.usersService.updateAvatar(userId, file); // TODO: replace userId with req.user.id
  }
}
