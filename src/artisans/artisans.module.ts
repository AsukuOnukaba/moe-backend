import { Module } from '@nestjs/common';
import { KeywordsModule } from '../keywords/keywords.module';
import { ArtisanReviewsService } from './artisan-reviews.service';
import { ArtisansController } from './artisans.controller';
import { ArtisansService } from './artisans.service';

@Module({
  imports: [KeywordsModule],
  controllers: [ArtisansController],
  providers: [ArtisansService, ArtisanReviewsService],
  exports: [ArtisanReviewsService],
})
export class ArtisansModule {}

