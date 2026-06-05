import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductReviewsService } from './product-reviews.service';
import { ProductsService } from './products.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, ProductReviewsService],
})
export class ProductsModule {}

