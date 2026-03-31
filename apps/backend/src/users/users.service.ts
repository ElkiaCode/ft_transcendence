import { Injectable, NotFoundException } from '@nestjs/common';
import { UpdateProfileDto } from './dto/dto';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { PrismaService } from './prisma.service';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from './minio.client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // Récupérer un utilisateur par ID
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }
    return user;
  }

  // Mettre à jour un utilisateur et renvoyer ProfileResponseDto
  async update(
    id: string,
    updateUserDto: UpdateProfileDto,
    file?: Express.Multer.File,
  ): Promise<ProfileResponseDto> {
    const user = await this.findOne(id);

    // Si un avatar est fourni, l'envoyer sur MinIO
    let avatarKey = user.avatar;
    if (file) {
      const bucketName = 'avatars';
      avatarKey = `${id}-${Date.now()}-${file.originalname}`;

      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: avatarKey,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
    }

    // Mettre à jour l'utilisateur
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        ...updateUserDto,
        avatar: avatarKey,
      },
    });
    const profile: ProfileResponseDto = {
      id: updatedUser.id,
      displayName: updatedUser.username,
      bio: updatedUser.bio ?? null,
      avatarUrl: updatedUser.avatar
        ? `http://localhost:9000/avatars/${updatedUser.avatar}`
        : null,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };

    return profile;
  }
}