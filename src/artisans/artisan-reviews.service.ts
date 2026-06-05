import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';

@Injectable()
export class ArtisanReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureArtisan(artisanId: number) {
    const profile = await this.prisma.artisanProfile.findUnique({
      where: { userId: artisanId },
    });
    if (!profile) {
      throw new NotFoundException({
        message: 'Not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    return profile;
  }

  private toReviewDto(review: {
    id: number;
    artisanId: number;
    customerId: number;
    rating: number;
    comment: string | null;
    createdAt: Date;
    updatedAt: Date;
    customer?: { name: string } | null;
  }) {
    return {
      id: review.id,
      artisanId: review.artisanId,
      providerId: review.artisanId,
      customerId: review.customerId,
      rating: review.rating,
      comment: review.comment ?? '',
      customerName: review.customer?.name ?? null,
      createdAt: review.createdAt.toISOString(),
      updatedAt: review.updatedAt.toISOString(),
    };
  }

  async list(artisanId: number, query: { page?: number; pageSize?: number }) {
    await this.ensureArtisan(artisanId);
    const page = Math.max(1, Number(query?.page ?? 1));
    const pageSize = Math.max(1, Math.min(100, Number(query?.pageSize ?? 20)));
    const skip = (page - 1) * pageSize;

    const [items, totalItems] = await Promise.all([
      this.prisma.artisanReview.findMany({
        where: { artisanId },
        include: { customer: { select: { name: true } } },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.artisanReview.count({ where: { artisanId } }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    return {
      data: items.map((r) => this.toReviewDto(r)),
      pagination: { page, pageSize, totalPages, totalItems },
    };
  }

  async upsert(
    artisanId: number,
    customer: AccessTokenPayload,
    body: { rating?: number; comment?: string },
  ) {
    await this.ensureArtisan(artisanId);
    const rating = Math.round(Number(body?.rating ?? 0));
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException({
        message: 'rating must be between 1 and 5',
        code: 'VALIDATION_ERROR',
      });
    }
    const comment =
      typeof body?.comment === 'string' && body.comment.trim()
        ? body.comment.trim()
        : null;

    const review = await this.prisma.artisanReview.upsert({
      where: {
        customerId_artisanId: {
          customerId: customer.sub,
          artisanId,
        },
      },
      create: {
        artisanId,
        customerId: customer.sub,
        rating,
        comment,
      },
      update: { rating, comment },
      include: { customer: { select: { name: true } } },
    });

    return this.toReviewDto(review);
  }
}
