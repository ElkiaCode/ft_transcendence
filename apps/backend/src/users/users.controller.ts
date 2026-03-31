import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';

@Controller('users') 
export class UsersController { 
    constructor(private usersService: UsersService) {} 
    
    @Post('me/avatar') 
    @UseInterceptors(FileInterceptor('file')) 
    uploadAvatar(userId: number, @UploadedFile() file: Express.Multer.File) { 
        return this.usersService.uploadAvatar(userId, file); 
    }
}