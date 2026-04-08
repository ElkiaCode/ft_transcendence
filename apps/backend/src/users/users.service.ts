import { Injectable, NotFoundException } from '@nestjs/common';
import { UpdateProfileDto } from './dto/dto';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { PrismaService } from './prisma.service';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from './minio.client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });
    if (!user) throw new NotFoundException(`User #${id} not found`);
    return user;
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    const user = await this.findOne(userId);
    if (!user.profile) throw new NotFoundException('Profile not found');

    const updated = await this.prisma.profile.update({
      where: { userId },
      data: {
        displayName: dto.displayName ?? user.profile.displayName,
        bio: dto.bio ?? user.profile.bio,
      },
    });

    return this.toProfileDto(updated);
  }

  async updateAvatar(
    userId: string,
    file: any,
  ): Promise<ProfileResponseDto> {
    const user = await this.findOne(userId);
    if (!user.profile) throw new NotFoundException('Profile not found');

    const bucketName = 'avatars';
    const avatarKey = `${userId}-${Date.now()}-${file.originalname}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: avatarKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    const updated = await this.prisma.profile.update({
      where: { userId },
      data: {
        avatarKey,
        avatarUrl: `http://localhost:9000/${bucketName}/${avatarKey}`,
      },
    });

    return this.toProfileDto(updated);
  }

  private toProfileDto(profile: {
    id: string;
    displayName: string;
    bio?: string | null;
    avatarUrl?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): ProfileResponseDto {
    return {
      id: profile.id,
      displayName: profile.displayName,
      bio: profile.bio ?? null,
      avatarUrl: profile.avatarUrl ?? null,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }
}
