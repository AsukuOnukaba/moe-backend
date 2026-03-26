import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

type Pagination = {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
};

function toTagArray(value: string | null) {
  if (!value) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

function productToDto(p: any) {
  const price = typeof p.price === 'number' ? p.price : 0;
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? '',
    priceRange: { min: price, max: price },
    currency: p.currency ?? 'NGN',
    estimatedDeliveryDays: p.estimatedDeliveryDays ?? 7,
    materials: p.materials ?? '',
    tags: toTagArray(p.tags ?? null),
    images: p.imageUrl ? [p.imageUrl] : [],
    category: p.category ?? null,
    providerId: p.providerId,
    featured: p.featured ?? false,
    isBestSeller: p.isBestSeller ?? false,
    isTrending: p.isTrending ?? false,
    isNewArrival: p.isNewArrival ?? false,
    discountPercent: p.discountPercent ?? null,
    originalPrice: p.originalPrice ?? null,
  };
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async listProducts(query: any) {
    const page = Math.max(1, Number(query?.page ?? 1));
    const pageSize = Math.max(1, Math.min(100, Number(query?.pageSize ?? 20)));
    const skip = (page - 1) * pageSize;

    const q = typeof query?.q === 'string' ? query.q.trim() : '';
    const category = typeof query?.category === 'string' ? query.category : undefined;
    const featured =
      query?.featured === 'true' ? true : query?.featured === 'false' ? false : undefined;

    const priceMin = query?.priceMin !== undefined ? Number(query.priceMin) : undefined;
    const priceMax = query?.priceMax !== undefined ? Number(query.priceMax) : undefined;

    const where: any = {};
    if (category) where.category = category;
    if (featured !== undefined) where.featured = featured;
    if (priceMin !== undefined || priceMax !== undefined) {
      where.price = {};
      if (priceMin !== undefined) where.price.gte = priceMin;
      if (priceMax !== undefined) where.price.lte = priceMax;
    }

    if (q.length >= 2) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { materials: { contains: q, mode: 'insensitive' } },
        { tags: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [totalItems, items] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: this.getSort(query),
        skip,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const pagination: Pagination = { page, pageSize, totalPages, totalItems };

    return {
      data: items.map(productToDto),
      pagination,
    };
  }

  private getSort(query: any) {
    const sort = typeof query?.sort === 'string' ? query.sort : '';
    switch (sort) {
      case 'price_asc':
        return { price: 'asc' as const };
      case 'price_desc':
        return { price: 'desc' as const };
      case 'newest':
        return { updatedAt: 'desc' as const };
      default:
        return { updatedAt: 'desc' as const };
    }
  }

  async getProductById(id: number) {
    const p = await this.prisma.product.findUnique({ where: { id } });
    if (!p) return null;
    return productToDto(p);
  }

  async recommendations(query: any) {
    // TEMP: use trending/popular fallback; will switch to personalized recommendations later.
    const page = Math.max(1, Number(query?.page ?? 1));
    const pageSize = Math.max(1, Math.min(100, Number(query?.pageSize ?? 10)));
    const skip = (page - 1) * pageSize;

    const items = await this.prisma.product.findMany({
      orderBy: { updatedAt: 'desc' },
      skip,
      take: pageSize,
    });

    const totalItems = items.length; // without filter metadata
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    return {
      data: items.map(productToDto),
      pagination: { page, pageSize, totalPages, totalItems },
    };
  }

  async variants(_productId: number) {
    // TEMP: product variants not modeled yet.
    return [];
  }

  async listProductsByProvider(providerId: number, query: any) {
    const page = Math.max(1, Number(query?.page ?? 1));
    const pageSize = Math.max(1, Math.min(100, Number(query?.pageSize ?? 20)));
    const skip = (page - 1) * pageSize;

    const totalItems = await this.prisma.product.count({ where: { providerId } });
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    const items = await this.prisma.product.findMany({
      where: { providerId },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: pageSize,
    });

    return {
      data: items.map(productToDto),
      pagination: { page, pageSize, totalPages, totalItems },
    };
  }
}

