import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { ArtisanReviewsService } from '../artisans/artisan-reviews.service';
import { ServiceProvidersService } from './service-providers.service';

@Controller('service-providers')
export class ServiceProvidersController {
  constructor(
    private readonly providers: ServiceProvidersService,
    private readonly reviews: ArtisanReviewsService,
  ) {}

  @Get('public-info')
  listPublicInfo(@Query() query: Record<string, string>) {
    return this.providers.listPublicInfo(query);
  }

  @Get(':id/public-info')
  getPublicInfo(@Param('id') id: string) {
    return this.providers.getProviderPublicInfo(Number(id));
  }

  @Get(':id/products')
  productsByProvider(@Param('id') id: string, @Query() query: Record<string, string>) {
    return this.providers.listProductsByProvider(Number(id), query);
  }

  @Get('recommendations')
  recommendations() {
    return this.providers.recommendations();
  }

  @Get(':id/reviews')
  listReviews(@Param('id') id: string, @Query() query: Record<string, string>) {
    return this.reviews.list(Number(id), {
      page: query.page ? Number(query.page) : undefined,
      pageSize: query.pageSize ? Number(query.pageSize) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/reviews')
  upsertReview(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() body: { rating?: number; comment?: string },
  ) {
    const user = req.user as AccessTokenPayload;
    return this.reviews.upsert(Number(id), user, body);
  }
}
