import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateReportDto {
  @IsEnum(['USER', 'MESSAGE'])
  targetType!: 'USER' | 'MESSAGE';

  @IsOptional()
  @IsString()
  targetUserId?: string;

  @IsOptional()
  @IsString()
  targetMessageId?: string;

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;
}
