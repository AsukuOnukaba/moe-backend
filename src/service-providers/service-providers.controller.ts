import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { ServiceProvidersService } from './service-providers.service';

type Review = {
  id: number;
  providerId: number;
  customerId: number;
  orderId: string | null;
  rating: number;
  comment: string;
  createdAt: string;
};

// TEMP: in-memory reviews until DB models are added.
const reviewStore = new Map<number, Review[]>();
let reviewIdSeq = 1;

@Controller('service-providers')
export class ServiceProvidersController {
  constructor(private readonly providers: ServiceProvidersService) {}

  @Get('public-info')
  listPublicInfo(@Query() query: any) {
    return this.providers.listPublicInfo(query);
  }

  @Get(':id/public-info')
  getPublicInfo(@Param('id') id: string) {
    return this.providers.getProviderPublicInfo(Number(id));
  }

  @Get(':id/products')
  productsByProvider(@Param('id') id: string, @Query() query: any) {
    return this.providers.listProductsByProvider(Number(id), query);
  }

  @Get('recommendations')
  recommendations() {
    return this.providers.recommendations();
  }

  @Get(':id/reviews')
  listReviews(@Param('id') id: string, @Query() query: any) {
    const providerId = Number(id);
    const all = reviewStore.get(providerId) ?? [];

    const page = Math.max(1, Number(query?.page ?? 1));
    const pageSize = Math.max(1, Math.min(100, Number(query?.pageSize ?? 20)));
    const skip = (page - 1) * pageSize;

    const items = all.slice(skip, skip + pageSize);
    const totalItems = all.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    return {
      data: items,
      pagination: { page, pageSize, totalPages, totalItems },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/reviews')
  async createReview(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() body: any,
  ) {
    const providerId = Number(id);
    const user = req.user as AccessTokenPayload | undefined;
    const customerId = user?.sub;
    if (!customerId) {
      return { message: 'Unauthorized', code: 'AUTH_TOKEN_EXPIRED' };
    }

    const rating = Math.max(1, Math.min(5, Number(body?.rating ?? 5)));
    const comment = typeof body?.comment === 'string' ? body.comment : '';
    const createdAt = new Date().toISOString();

    const review: Review = {
      id: reviewIdSeq++,
      providerId,
      customerId,
      orderId: body?.orderId ?? null,
      rating,
      comment,
      createdAt,
    };

    const arr = reviewStore.get(providerId) ?? [];
    reviewStore.set(providerId, [...arr, review]);
    return review;
  }
}

