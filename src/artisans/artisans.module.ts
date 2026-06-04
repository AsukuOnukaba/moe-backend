import { Module } from '@nestjs/common';
import { ArtisanReviewsService } from './artisan-reviews.service';
import { ArtisansController } from './artisans.controller';
import { ArtisansService } from './artisans.service';

@Module({
  controllers: [ArtisansController],
  providers: [ArtisansService, ArtisanReviewsService],
  exports: [ArtisanReviewsService],
})
export class ArtisansModule {}

