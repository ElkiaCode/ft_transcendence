import { Body, Controller, Get, Patch, Post, Param, UseGuards } from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreateReportDto } from './dto/create-report.dto';
import { ReviewReportDto } from './dto/review-report.dto';

@Controller('moderation')
@UseGuards(JwtAuthGuard)
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post('reports')
  createReport(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateReportDto,
  ) {
    return this.moderationService.createReport(
      user.sub,
      dto.targetType,
      dto.targetUserId,
      dto.targetMessageId,
      dto.reason,
    );
  }

  @Get('reports')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MODERATOR')
  listReports() {
    return this.moderationService.listReports();
  }

  @Patch('reports/:id/review')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MODERATOR')
  reviewReport(
    @CurrentUser() user: JwtPayload,
    @Param('id') reportId: string,
    @Body() dto: ReviewReportDto,
  ) {
    return this.moderationService.reviewReport(
      user.sub,
      reportId,
      dto.action,
      dto.note,
    );
  }
}