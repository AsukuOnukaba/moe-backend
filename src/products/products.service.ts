import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { productToDto } from '../common/product-mapper';
import { getCustomisationTemplate } from './product-customisation.templates';

type Pagination = {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
};

const APPROVED_STATUS = 'approved';

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

    const where: any = { status: APPROVED_STATUS };
    if (category) where.category = category;
    if (featured !== undefined) where.featured = featured;

    const styleTags =
      typeof query?.styleTags === 'string'
        ? query.styleTags.split(',').map((s: string) => s.trim()).filter(Boolean)
        : Array.isArray(query?.styleTags)
          ? query.styleTags.map((s: string) => String(s).trim()).filter(Boolean)
          : [];
    if (styleTags.length > 0) {
      where.AND = styleTags.map((tag: string) => ({
        tags: { contains: tag, mode: 'insensitive' },
      }));
    }
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
    const p = await this.prisma.product.findFirst({
      where: { id, status: APPROVED_STATUS },
    });
    if (!p) return null;
    return productToDto(p);
  }

  async getCustomisationTemplate(category: string) {
    return { category, fields: getCustomisationTemplate(category) };
  }

  async getFilterMeta() {
    const approved = { status: APPROVED_STATUS };
    const [categories, tagRows, priceAgg, deliveryRows] = await Promise.all([
      this.prisma.product.findMany({
        where: approved,
        distinct: ['category'],
        select: { category: true },
      }),
      this.prisma.product.findMany({
        where: { ...approved, tags: { not: null } },
        select: { tags: true },
      }),
      this.prisma.product.aggregate({
        where: approved,
        _min: { price: true },
        _max: { price: true },
      }),
      this.prisma.product.findMany({
        where: approved,
        distinct: ['estimatedDeliveryDays'],
        select: { estimatedDeliveryDays: true },
      }),
    ]);

    const styleTagSet = new Set<string>();
    for (const row of tagRows) {
      if (!row.tags) continue;
      for (const tag of row.tags.split(',')) {
        const t = tag.trim();
        if (t) styleTagSet.add(t);
      }
    }

    return {
      categories: categories
        .map((c) => c.category)
        .filter((c): c is string => Boolean(c))
        .sort(),
      styleTags: [...styleTagSet].sort(),
      priceRange: {
        min: priceAgg._min.price ?? 0,
        max: priceAgg._max.price ?? 0,
      },
      deliveryDays: deliveryRows
        .map((d) => d.estimatedDeliveryDays)
        .filter((d): d is number => d != null)
        .sort((a, b) => a - b),
    };
  }

  async recommendations(query: any) {
    // TEMP: use trending/popular fallback; will switch to personalized recommendations later.
    const page = Math.max(1, Number(query?.page ?? 1));
    const pageSize = Math.max(1, Math.min(100, Number(query?.pageSize ?? 10)));
    const skip = (page - 1) * pageSize;

    const items = await this.prisma.product.findMany({
      where: { status: APPROVED_STATUS },
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

