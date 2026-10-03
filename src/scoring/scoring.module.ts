import { Module } from '@nestjs/common';
import { ArtisanScoringService } from './artisan-scoring.service';
import { ArtisanScoringScheduler } from './artisan-scoring.scheduler';

@Module({
  providers: [ArtisanScoringService, ArtisanScoringScheduler],
  exports: [ArtisanScoringService],
})
export class ScoringModule {}
