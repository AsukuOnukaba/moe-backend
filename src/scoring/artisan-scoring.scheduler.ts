import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ArtisanScoringService } from './artisan-scoring.service';

@Injectable()
export class ArtisanScoringScheduler {
  private readonly logger = new Logger(ArtisanScoringScheduler.name);

  constructor(private readonly scoring: ArtisanScoringService) {}

  /** Daily 02:00 Africa/Lagos (configurable via TZ for the process). */
  @Cron('0 2 * * *', { timeZone: process.env.APP_TIMEZONE || 'Africa/Lagos' })
  async handleDailyRecalc() {
    if (this.scoring.isRecalculating()) {
      this.logger.warn('Skipping scheduled recalc — already running');
      return;
    }
    this.logger.log('Starting scheduled artisan score recalculation');
    const result = await this.scoring.recalculateAll();
    this.logger.log(`Scheduled recalc finished: ${result.processed} artisans`);
  }
}
