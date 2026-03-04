import { Module } from '@nestjs/common';
import { StatsModule } from '../stats/stats.module';
import {
  AdminDisputesController,
  MatchesController,
  PlayerMatchesController,
} from './matches.controller';
import { MatchesService } from './matches.service';

@Module({
  imports: [StatsModule],
  controllers: [MatchesController, PlayerMatchesController, AdminDisputesController],
  providers: [MatchesService],
  exports: [MatchesService],
})
export class MatchesModule {}
