import { IsEnum } from 'class-validator';

export class AddMessageReactionDto {
  @IsEnum(['THUMBS_UP', 'HEART'])
  type!: 'THUMBS_UP' | 'HEART';
}
