import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewReportDto {
  @IsEnum(['WARN', 'BAN', 'UNBAN', 'DISMISS_REPORT'])
  action: 'WARN' | 'BAN' | 'UNBAN' | 'DISMISS_REPORT';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}