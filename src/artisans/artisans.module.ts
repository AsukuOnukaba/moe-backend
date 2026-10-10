import { Module } from '@nestjs/common';
import { KeywordsModule } from '../keywords/keywords.module';
import { ArtisanReviewsService } from './artisan-reviews.service';
import { ArtisanVerificationService } from './artisan-verification.service';
import { ArtisansController } from './artisans.controller';
import { ArtisansService } from './artisans.service';
import { ProductVariationsService } from './product-variations.service';

@Module({
  imports: [KeywordsModule],
  controllers: [ArtisansController],
  providers: [ArtisansService, ArtisanReviewsService, ArtisanVerificationService, ProductVariationsService],
  exports: [ArtisanReviewsService, ArtisanVerificationService, ProductVariationsService],
})
export class ArtisansModule {}

