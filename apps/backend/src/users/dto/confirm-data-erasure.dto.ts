import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ConfirmDataErasureDto {
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  token!: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  currentPassword?: string;
}
