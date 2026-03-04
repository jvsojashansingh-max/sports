import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { SportId } from '@prisma/client';
import { RequireAction } from '../../common/decorators/require-action.decorator';
import { ListLeaderboardsQueryDto, UpsertLevelThresholdDto } from './stats.dto';
import { StatsService } from './stats.service';

@Controller()
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('leaderboards')
  listLeaderboards(@Query() query: ListLeaderboardsQueryDto) {
    return this.statsService.listLeaderboards(query);
  }

  @Get('admin/level-thresholds')
  @RequireAction('dispute.admin.review')
  listLevelThresholds(@Query('sportId') sportId?: SportId) {
    return this.statsService.listLevelThresholds(sportId);
  }

  @Post('admin/level-thresholds')
  @RequireAction('dispute.admin.review')
  upsertLevelThreshold(@Body() body: UpsertLevelThresholdDto) {
    return this.statsService.upsertLevelThreshold(body);
  }
}
