import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class EraseMyDataDto {
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  currentPassword?: string;
}
