import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { ProductReviewsService } from './product-reviews.service';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly reviews: ProductReviewsService,
  ) {}

  @Get('customisation-template')
  customisationTemplate(@Query('category') category: string) {
    return this.products.getCustomisationTemplate(category ?? '');
  }

  @Get('filter-meta')
  filterMeta() {
    return this.products.getFilterMeta();
  }

  @Get()
  list(@Query() query: Record<string, string>) {
    return this.products.listProducts(query);
  }

  @Get('recommendations')
  recommendations(@Query() query: Record<string, string>) {
    return this.products.recommendations(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/reviews/mine')
  getMyReview(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as AccessTokenPayload;
    return this.reviews.getMine(Number(id), user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/reviews/mine')
  patchMyReview(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() body: { rating?: number; review?: string },
  ) {
    const user = req.user as AccessTokenPayload;
    return this.reviews.patchMine(Number(id), user, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/reviews')
  upsertReview(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() body: { rating?: number; review?: string },
  ) {
    const user = req.user as AccessTokenPayload;
    return this.reviews.upsert(Number(id), user, body);
  }

  @Get(':id/reviews')
  listReviews(
    @Param('id') id: string,
    @Query() query: Record<string, string>,
  ) {
    return this.reviews.listPublic(Number(id), {
      page: query.page ? Number(query.page) : undefined,
      pageSize: query.pageSize ? Number(query.pageSize) : undefined,
    });
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    const product = await this.products.getProductById(Number(id));
    if (!product) return { message: 'Not found', code: 'RESOURCE_NOT_FOUND' };
    return product;
  }

  @Get(':id/variants')
  variants(@Param('id') id: string) {
    return this.products.variants(Number(id));
  }
}
