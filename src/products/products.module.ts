import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { ProductsController } from './products.controller';
import { ProductReviewsService } from './product-reviews.service';
import { ProductsService } from './products.service';

@Module({
  imports: [EventsModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductReviewsService],
  exports: [ProductsService],
})
export class ProductsModule {}

