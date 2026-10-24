import { Injectable } from '@nestjs/common';
import { activeProductWhere } from '../common/active-product';
import { PrismaService } from '../database/prisma.service';
import { productToDto } from '../common/product-mapper';
import { EventsService } from '../events/events.service';
import { getCustomisationTemplate } from './product-customisation.templates';

type Pagination = {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
};

const APPROVED_STATUS = 'approved';

function parseBoolQuery(value: unknown): boolean | undefined {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  async listProducts(query: any) {
    const page = Math.max(1, Number(query?.page ?? 1));
    const pageSize = Math.max(1, Math.min(100, Number(query?.pageSize ?? 20)));
    const skip = (page - 1) * pageSize;

    const q = typeof query?.q === 'string' ? query.q.trim() : '';
    const category = typeof query?.category === 'string' ? query.category : undefined;
    const featured =
      query?.featured === 'true' ? true : query?.featured === 'false' ? false : undefined;

    // Accept both minPrice/maxPrice (preferred) and legacy priceMin/priceMax.
    const minPriceRaw = query?.minPrice ?? query?.priceMin;
    const maxPriceRaw = query?.maxPrice ?? query?.priceMax;
    const minPrice =
      minPriceRaw !== undefined && minPriceRaw !== '' ? Number(minPriceRaw) : undefined;
    const maxPrice =
      maxPriceRaw !== undefined && maxPriceRaw !== '' ? Number(maxPriceRaw) : undefined;
    const country =
      typeof query?.country === 'string' && query.country.trim()
        ? query.country.trim()
        : undefined;
    const state =
      typeof query?.state === 'string' && query.state.trim()
        ? query.state.trim()
        : undefined;
    const isBestSeller = parseBoolQuery(query?.isBestSeller);
    const isTrending = parseBoolQuery(query?.isTrending);
    const isNewArrival = parseBoolQuery(query?.isNewArrival);
    const maxDeliveryDaysRaw = query?.maxDeliveryDays;
    const maxDeliveryDays =
      maxDeliveryDaysRaw !== undefined && maxDeliveryDaysRaw !== ''
        ? Number(maxDeliveryDaysRaw)
        : undefined;
    const materials =
      typeof query?.materials === 'string'
        ? query.materials.split(',').map((s: string) => s.trim()).filter(Boolean)
        : Array.isArray(query?.materials)
          ? query.materials.map((s: string) => String(s).trim()).filter(Boolean)
          : [];

    const where: any = { status: APPROVED_STATUS, ...activeProductWhere };
    if (category) where.category = category;
    if (featured !== undefined) where.featured = featured;
    if (isBestSeller !== undefined) where.isBestSeller = isBestSeller;
    if (isTrending !== undefined) where.isTrending = isTrending;
    if (isNewArrival !== undefined) where.isNewArrival = isNewArrival;
    if (Number.isFinite(maxDeliveryDays) && (maxDeliveryDays as number) > 0) {
      where.estimatedDeliveryDays = { lte: maxDeliveryDays };
    }

    const styleTags =
      typeof query?.styleTags === 'string'
        ? query.styleTags.split(',').map((s: string) => s.trim()).filter(Boolean)
        : Array.isArray(query?.styleTags)
          ? query.styleTags.map((s: string) => String(s).trim()).filter(Boolean)
          : [];
    const andFilters: any[] = [];
    if (styleTags.length > 0) {
      andFilters.push(
        ...styleTags.map((tag: string) => ({
          tags: { contains: tag, mode: 'insensitive' },
        })),
      );
    }
    if (materials.length > 0) {
      andFilters.push(
        ...materials.map((material: string) => ({
          materials: { contains: material, mode: 'insensitive' },
        })),
      );
    }
    if (andFilters.length > 0) where.AND = andFilters;
    if (
      (minPrice !== undefined && Number.isFinite(minPrice)) ||
      (maxPrice !== undefined && Number.isFinite(maxPrice))
    ) {
      where.price = {};
      if (minPrice !== undefined && Number.isFinite(minPrice)) where.price.gte = minPrice;
      if (maxPrice !== undefined && Number.isFinite(maxPrice)) where.price.lte = maxPrice;
    }

    if (country || state) {
      where.provider = {
        artisanProfile: {
          ...(country
            ? { country: { equals: country, mode: 'insensitive' } }
            : {}),
          ...(state ? { state: { equals: state, mode: 'insensitive' } } : {}),
        },
      };
    }

    if (q.length >= 2) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { materials: { contains: q, mode: 'insensitive' } },
        { tags: { contains: q, mode: 'insensitive' } },
      ];
    }

    const sortKey = typeof query?.sort === 'string' ? query.sort : '';
    const nameDirection = sortKey === 'name_desc' ? -1 : sortKey === 'price_asc' || sortKey === 'price_desc' || sortKey === 'newest' || sortKey === 'bestSeller' || sortKey === 'trending' ? 0 : 1;

    let totalItems: number;
    let items: Awaited<ReturnType<PrismaService['product']['findMany']>>;
    if (nameDirection !== 0) {
      const rows = await this.prisma.product.findMany({
        where,
        select: { id: true, name: true },
      });
      rows.sort(
        (a, b) =>
          nameDirection * a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) ||
          a.id - b.id,
      );
      totalItems = rows.length;
      const pageIds = rows.slice(skip, skip + pageSize).map((row) => row.id);
      const pageRows = pageIds.length
        ? await this.prisma.product.findMany({ where: { id: { in: pageIds } } })
        : [];
      const byId = new Map(pageRows.map((row) => [row.id, row]));
      items = pageIds.map((id) => byId.get(id)).filter((row) => row !== undefined);
    } else {
      [totalItems, items] = await Promise.all([
        this.prisma.product.count({ where }),
        this.prisma.product.findMany({
          where,
          orderBy: this.getSort(query),
          skip,
          take: pageSize,
        }),
      ]);
    }

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
      case 'bestSeller':
        return [{ isBestSeller: 'desc' as const }, { name: 'asc' as const }];
      case 'trending':
        return [{ isTrending: 'desc' as const }, { name: 'asc' as const }];
      case 'name_desc':
        return { name: 'desc' as const };
      case 'name_asc':
      case 'name':
      default:
        // Req 4 — alphabetical unless the caller asked for another ranking.
        return { name: 'asc' as const };
    }
  }

  async getProductById(id: number) {
    const p = await this.prisma.product.findFirst({
      where: { id, status: APPROVED_STATUS, ...activeProductWhere },
      include: {
        keywords: { include: { keyword: true } },
        variationTypes: { include: { options: true } },
        artisan: {
          select: {
            userId: true,
            brandName: true,
            businessName: true,
            isCustomOrderEligible: true,
            customOrdersEnabled: true,
            heroImage: true,
            rating: true,
            reviewCount: true,
            verified: true,
            user: { select: { name: true, avatarUrl: true } },
          },
        },
        provider: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            artisanProfile: {
              select: {
                brandName: true,
                businessName: true,
                isCustomOrderEligible: true,
                customOrdersEnabled: true,
                heroImage: true,
                rating: true,
                reviewCount: true,
                verified: true,
              },
            },
          },
        },
      },
    });
    if (!p) return null;
    const views = await this.events.productViewStats(id);
    const artisan = mapProductArtisan(p);
    return { ...productToDto(p), artisan, ...views };
  }

  /** Batch lookup preserving caller order (for recently viewed). */
  async getProductsByIds(ids: number[]) {
    if (!ids.length) return [];
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: ids },
        status: APPROVED_STATUS,
        ...activeProductWhere,
      },
      include: {
        keywords: { include: { keyword: true } },
        variationTypes: { include: { options: true } },
      },
    });
    const byId = new Map(products.map((p) => [p.id, productToDto(p)]));
    return ids.map((id) => byId.get(id)).filter(Boolean);
  }

  async getCustomisationTemplate(category: string) {
    return { category, fields: getCustomisationTemplate(category) };
  }

  async getFilterMeta() {
    const approved = { status: APPROVED_STATUS, ...activeProductWhere };
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
      where: { status: APPROVED_STATUS, ...activeProductWhere },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: pageSize,
    });

    const totalItems = await this.prisma.product.count({
      where: { status: APPROVED_STATUS, ...activeProductWhere },
    });
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    return {
      data: items.map(productToDto),
      pagination: { page, pageSize, totalPages, totalItems },
    };
  }

  async variants(productId: number) {
    const rows = await this.prisma.productVariationType.findMany({
      where: { productId, isEnabled: true },
      include: { options: true },
      orderBy: { typeName: 'asc' },
    });
    return rows.flatMap((t) =>
      t.options.map((o) => ({
        id: o.id,
        productId,
        name: o.label,
        type: t.typeName,
        value: o.value,
        priceModifier: o.priceOverride ?? 0,
        stockCount: o.stockCount,
        isAvailable: o.isAvailable !== false && !(o.stockCount != null && o.stockCount === 0),
      })),
    );
  }

  async listProductsByProvider(providerId: number, query: any) {
    const page = Math.max(1, Number(query?.page ?? 1));
    const pageSize = Math.max(1, Math.min(100, Number(query?.pageSize ?? 20)));
    const skip = (page - 1) * pageSize;

    const totalItems = await this.prisma.product.count({
      where: { providerId, status: APPROVED_STATUS, ...activeProductWhere },
    });
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    const items = await this.prisma.product.findMany({
      where: { providerId, status: APPROVED_STATUS, ...activeProductWhere },
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

function mapProductArtisan(p: {
  artisanId?: number | null;
  providerId?: number | null;
  artisan?: {
    userId: number;
    brandName: string | null;
    businessName: string | null;
    isCustomOrderEligible: boolean;
    customOrdersEnabled: boolean;
    heroImage: string | null;
    rating: number;
    reviewCount: number;
    verified: boolean;
    user: { name: string; avatarUrl: string | null };
  } | null;
  provider?: {
    id: number;
    name: string;
    avatarUrl: string | null;
    artisanProfile: {
      brandName: string | null;
      businessName: string | null;
      isCustomOrderEligible: boolean;
      customOrdersEnabled: boolean;
      heroImage: string | null;
      rating: number;
      reviewCount: number;
      verified: boolean;
    } | null;
  } | null;
}) {
  if (p.artisan) {
    return {
      id: p.artisan.userId,
      name: p.artisan.user.name,
      brandName: p.artisan.brandName ?? p.artisan.user.name,
      businessName: p.artisan.businessName ?? null,
      heroImage: p.artisan.heroImage ?? null,
      avatarUrl: p.artisan.user.avatarUrl ?? null,
      rating: p.artisan.rating ?? 0,
      reviewCount: p.artisan.reviewCount ?? 0,
      verified: p.artisan.verified ?? false,
      isCustomOrderEligible:
        p.artisan.isCustomOrderEligible || p.artisan.customOrdersEnabled,
      customOrdersEnabled: p.artisan.customOrdersEnabled ?? false,
    };
  }
  if (p.provider?.artisanProfile) {
    const ap = p.provider.artisanProfile;
    return {
      id: p.provider.id,
      name: p.provider.name,
      brandName: ap.brandName ?? p.provider.name,
      businessName: ap.businessName ?? null,
      heroImage: ap.heroImage ?? null,
      avatarUrl: p.provider.avatarUrl ?? null,
      rating: ap.rating ?? 0,
      reviewCount: ap.reviewCount ?? 0,
      verified: ap.verified ?? false,
      isCustomOrderEligible:
        ap.isCustomOrderEligible || ap.customOrdersEnabled,
      customOrdersEnabled: ap.customOrdersEnabled ?? false,
    };
  }
  if (p.providerId != null || p.artisanId != null) {
    return {
      id: p.artisanId ?? p.providerId,
      isCustomOrderEligible: false,
      customOrdersEnabled: false,
    };
  }
  return null;
}

