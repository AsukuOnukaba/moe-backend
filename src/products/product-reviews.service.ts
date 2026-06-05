import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { formatReviewerName } from '../common/reviewer-name';

@Injectable()
export class ProductReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getApprovedProduct(productId: number) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, status: 'approved' },
    });
    if (!product) {
      throw new NotFoundException({
        message: 'Not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    return product;
  }

  private toPublicReview(row: {
    id: number;
    rating: number;
    review: string | null;
    createdAt: Date;
    updatedAt: Date;
    customer: { name: string };
  }) {
    return {
      id: row.id,
      rating: row.rating,
      review: row.review,
      reviewerName: formatReviewerName(row.customer.name),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toMineReview(row: {
    id: number;
    rating: number;
    review: string | null;
    createdAt?: Date;
  }) {
    return {
      id: row.id,
      rating: row.rating,
      review: row.review,
      ...(row.createdAt ? { createdAt: row.createdAt.toISOString() } : {}),
    };
  }

  private validateRating(rating: unknown): number {
    const value = Math.round(Number(rating));
    if (!Number.isFinite(value) || value < 1 || value > 5) {
      throw new BadRequestException({
        message: 'rating must be between 1 and 5',
        code: 'VALIDATION_ERROR',
      });
    }
    return value;
  }

  private normalizeReview(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.length > 500) {
      throw new BadRequestException({
        message: 'review must be at most 500 characters',
        code: 'VALIDATION_ERROR',
      });
    }
    return trimmed;
  }

  private requireCustomer(user: AccessTokenPayload) {
    if (user.role !== 'customer') {
      throw new ForbiddenException({
        message: 'Forbidden',
        code: 'FORBIDDEN',
      });
    }
  }

  private async assertNotProductOwner(
    product: { providerId: number | null },
    userId: number,
  ) {
    if (product.providerId === userId) {
      throw new ForbiddenException({
        message: 'Artisans cannot review their own products',
        code: 'FORBIDDEN',
      });
    }
  }

  async refreshArtisanRatingFromProductReviews(artisanId: number) {
    const products = await this.prisma.product.findMany({
      where: { providerId: artisanId },
      select: { id: true },
    });
    const productIds = products.map((p) => p.id);
    if (productIds.length === 0) {
      await this.prisma.artisanProfile.update({
        where: { userId: artisanId },
        data: { rating: 0, reviewCount: 0 },
      });
      return;
    }

    const agg = await this.prisma.productReview.aggregate({
      where: { productId: { in: productIds }, status: 'approved' },
      _avg: { rating: true },
      _count: { id: true },
    });

    await this.prisma.artisanProfile.update({
      where: { userId: artisanId },
      data: {
        rating: agg._avg.rating ?? 0,
        reviewCount: agg._count.id,
      },
    });
  }

  async listPublic(
    productId: number,
    query: { page?: number; pageSize?: number },
  ) {
    await this.getApprovedProduct(productId);
    const page = Math.max(1, Number(query?.page ?? 1));
    const pageSize = Math.max(1, Math.min(100, Number(query?.pageSize ?? 5)));
    const skip = (page - 1) * pageSize;

    const where = { productId, status: 'approved' };

    const [items, totalItems, agg] = await Promise.all([
      this.prisma.productReview.findMany({
        where,
        include: { customer: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.productReview.count({ where }),
      this.prisma.productReview.aggregate({
        where,
        _avg: { rating: true },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    return {
      data: items.map((r) => this.toPublicReview(r)),
      averageRating: agg._avg.rating ?? 0,
      totalReviews: totalItems,
      pagination: { page, pageSize, totalPages, totalItems },
    };
  }

  async getMine(productId: number, customer: AccessTokenPayload) {
    this.requireCustomer(customer);
    await this.getApprovedProduct(productId);

    const row = await this.prisma.productReview.findUnique({
      where: {
        customerId_productId: {
          customerId: customer.sub,
          productId,
        },
      },
    });
    if (!row) {
      throw new NotFoundException({
        message: 'Not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    return this.toMineReview(row);
  }

  async upsert(
    productId: number,
    customer: AccessTokenPayload,
    body: { rating?: number; review?: string },
  ) {
    this.requireCustomer(customer);
    const product = await this.getApprovedProduct(productId);
    await this.assertNotProductOwner(product, customer.sub);

    const rating = this.validateRating(body?.rating);
    const review = this.normalizeReview(body?.review);

    const row = await this.prisma.productReview.upsert({
      where: {
        customerId_productId: {
          customerId: customer.sub,
          productId,
        },
      },
      create: {
        productId,
        customerId: customer.sub,
        rating,
        review,
      },
      update: { rating, review },
    });

    if (product.providerId) {
      await this.refreshArtisanRatingFromProductReviews(product.providerId);
    }

    return {
      ...this.toMineReview(row),
      createdAt: row.createdAt.toISOString(),
    };
  }

  async patchMine(
    productId: number,
    customer: AccessTokenPayload,
    body: { rating?: number; review?: string },
  ) {
    this.requireCustomer(customer);
    const product = await this.getApprovedProduct(productId);
    await this.assertNotProductOwner(product, customer.sub);

    const existing = await this.prisma.productReview.findUnique({
      where: {
        customerId_productId: {
          customerId: customer.sub,
          productId,
        },
      },
    });
    if (!existing) {
      throw new NotFoundException({
        message: 'Not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    const rating =
      body?.rating !== undefined
        ? this.validateRating(body.rating)
        : existing.rating;
    const review =
      body?.review !== undefined
        ? this.normalizeReview(body.review)
        : existing.review;

    const row = await this.prisma.productReview.update({
      where: { id: existing.id },
      data: { rating, review },
    });

    if (product.providerId) {
      await this.refreshArtisanRatingFromProductReviews(product.providerId);
    }

    return {
      ...this.toMineReview(row),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
