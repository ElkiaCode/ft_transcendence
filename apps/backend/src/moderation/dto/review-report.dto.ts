import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ReviewReportDto {
  @IsEnum(['WARN', 'BAN', 'UNBAN', 'DISMISS_REPORT'])
  action!: 'WARN' | 'BAN' | 'UNBAN' | 'DISMISS_REPORT';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  penaltyPointsToSubtract?: number;
}
