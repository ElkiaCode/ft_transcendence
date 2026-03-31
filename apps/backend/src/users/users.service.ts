import { Injectable } from '@nestjs/common';
@Injectable()
export class UsersService {
  uploadAvatar(userId: number, file: Express.Multer.File) {
    return {
      message: 'Avatar uploaded',
      userId,
      filename: file.originalname,
    };
  }
}

// ajouter sauvegarde du fichier , mise à jour de la base de données, etc...