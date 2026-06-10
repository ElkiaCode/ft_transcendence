import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AdjustPenaltyPointsDto {
  @Type(() => Number)
  @IsInt()
  @Min(-1000)
  @Max(1000)
  points!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
