import { Injectable, NotFoundException } from '@nestjs/common';
import { publicProductWhere } from '../common/active-product';
import { PrismaService } from '../database/prisma.service';
import { productToDto, toTagArray } from '../common/product-mapper';
import { toStringList } from '../common/string-list';

function splitCsv(value: string | null | undefined): string[] {
  return toTagArray(value);
}

@Injectable()
export class ServiceProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublicInfo(query: any) {
    const page = Math.max(1, Number(query?.page ?? 1));
    const pageSize = Math.max(1, Math.min(100, Number(query?.pageSize ?? 20)));
    const skip = (page - 1) * pageSize;

    // TEMP: treat artisan users as "providers".
    const category =
      typeof query?.category === 'string' ? query.category.trim() : undefined;
    const location =
      typeof query?.location === 'string' ? query.location.trim() : undefined;
    const country =
      typeof query?.country === 'string' ? query.country.trim() : undefined;
    const state =
      typeof query?.state === 'string' ? query.state.trim() : undefined;
    const city =
      typeof query?.city === 'string' ? query.city.trim() : undefined;
    const q =
      typeof query?.q === 'string'
        ? query.q.trim()
        : typeof query?.search === 'string'
          ? query.search.trim()
          : '';
    const serviceCategories =
      typeof query?.serviceCategories === 'string'
        ? query.serviceCategories.split(',').map((s: string) => s.trim()).filter(Boolean)
        : Array.isArray(query?.serviceCategories)
          ? query.serviceCategories.map((s: string) => String(s).trim()).filter(Boolean)
          : [];

    const artisans = await this.prisma.userRole.findMany({
      where: { role: { name: 'artisan' } },
      include: { user: { include: { artisanProfile: true } } },
      take: 1000,
    });

    let providers = artisans
      .map((ur) => ur.user)
      .filter((u: any) => u.artisanProfile?.status === 'approved')
      .map((u: any) => this.userToProvider(u, u.artisanProfile, false));

    if (category) {
      const cat = category.toLowerCase();
      const providerIdsWithProducts = await this.prisma.product.findMany({
        where: {
          category: cat,
          ...publicProductWhere,
        },
        select: { providerId: true },
        distinct: ['providerId'],
      });
      const productProviderIds = new Set(
        providerIdsWithProducts.map((p) => p.providerId),
      );
      providers = providers.filter(
        (p) =>
          p.category?.toLowerCase() === cat ||
          productProviderIds.has(p.id),
      );
    }
    if (location) {
      const loc = location.toLowerCase();
      providers = providers.filter(
        (p) =>
          p.city?.toLowerCase().includes(loc) ||
          p.location?.toLowerCase().includes(loc),
      );
    }
    if (country) {
      const c = country.toLowerCase();
      providers = providers.filter((p) => p.country?.toLowerCase() === c);
    }
    if (state) {
      const s = state.toLowerCase();
      providers = providers.filter((p) => p.state?.toLowerCase() === s);
    }
    if (city) {
      const c = city.toLowerCase();
      providers = providers.filter((p) => p.city?.toLowerCase() === c);
    }
    if (serviceCategories.length > 0) {
      providers = providers.filter((p) =>
        serviceCategories.some((sc: string) =>
          p.serviceCategories.some(
            (existing: string) => existing.toLowerCase() === sc.toLowerCase(),
          ),
        ),
      );
    }
    const featured =
      query?.featured === 'true' ? true : query?.featured === 'false' ? false : undefined;
    if (featured !== undefined) {
      providers = providers.filter((p) => p.featured === featured);
    }

    const customOrderEligible =
      query?.customOrderEligible === 'true' ||
      query?.customOrders === 'true' ||
      query?.isCustomOrderEligible === 'true';
    if (customOrderEligible) {
      providers = providers.filter((p) => p.isCustomOrderEligible === true);
    }

    const maxDeliveryDays = Number(query?.maxDeliveryDays);
    if (Number.isFinite(maxDeliveryDays) && maxDeliveryDays > 0) {
      providers = providers.filter(
        (p) => Number(p.estimatedDeliveryDays ?? 999) <= maxDeliveryDays,
      );
    }

    const minRating = Number(query?.minRating);
    if (Number.isFinite(minRating) && minRating > 0) {
      providers = providers.filter(
        (p) => Number(p.reviewCount ?? 0) > 0 && Number(p.rating ?? 0) >= minRating,
      );
    }

    if (query?.hasBestSeller === 'true' || query?.bestSeller === 'true') {
      const bestSellerProviders = await this.prisma.product.findMany({
        where: { isBestSeller: true, ...publicProductWhere },
        select: { providerId: true },
        distinct: ['providerId'],
      });
      const ids = new Set(
        bestSellerProviders
          .map((row) => row.providerId)
          .filter((id): id is number => typeof id === 'number'),
      );
      providers = providers.filter((p) => ids.has(p.id as number));
    }

    if (q.length >= 2) {
      const needle = q.toLowerCase();
      providers = providers.filter((p) => {
        const styleTags = Array.isArray(p.styleTags)
          ? p.styleTags
          : typeof p.styleTags === 'string'
            ? String(p.styleTags).split(',').map((s) => s.trim())
            : [];
        const blob = [
          p.brandName,
          p.businessName,
          p.category,
          p.city,
          p.state,
          p.country,
          ...styleTags,
          ...(Array.isArray(p.serviceCategories) ? p.serviceCategories : []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return blob.includes(needle);
      });
    }

    const sort = typeof query?.sort === 'string' ? query.sort : 'name';
    providers.sort((a, b) => {
      if (sort === 'rating') {
        const ratingDelta = Number(b.rating ?? 0) - Number(a.rating ?? 0);
        if (ratingDelta !== 0) return ratingDelta;
      }
      return String(a.brandName || '').localeCompare(String(b.brandName || ''), undefined, {
        sensitivity: 'base',
      });
    });

    const totalItems = providers.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const pageItems = providers.slice(skip, skip + pageSize);

    // Live productCount — same filter as GET …/products (approved + not deleted).
    const counts = await this.countPublicProducts(
      pageItems.map((p) => p.id as number),
    );
    const data = pageItems.map((p) => ({
      ...p,
      productCount: counts.get(p.id as number) ?? 0,
    }));

    return {
      data,
      pagination: { page, pageSize, totalPages, totalItems },
    };
  }

  async getProviderPublicInfo(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { artisanProfile: true },
    });
    if (!user || !user.artisanProfile || user.artisanProfile.status !== 'approved') {
      throw new NotFoundException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });
    }
    const productCount = await this.prisma.product.count({
      where: { providerId: id, ...publicProductWhere },
    });
    return {
      ...this.userToProvider(user, user.artisanProfile, false),
      productCount,
    };
  }

  async listProductsByProvider(providerId: number, query: any) {
    const products = await this.prisma.product.findMany({
      where: { providerId, ...publicProductWhere },
      orderBy: { updatedAt: 'desc' },
      skip: (Math.max(1, Number(query?.page ?? 1)) - 1) * Math.max(1, Number(query?.pageSize ?? 20)),
      take: Math.max(1, Number(query?.pageSize ?? 20)),
    });

    const page = Math.max(1, Number(query?.page ?? 1));
    const pageSize = Math.max(1, Number(query?.pageSize ?? 20));
    const totalItems = await this.prisma.product.count({
      where: { providerId, ...publicProductWhere },
    });
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    const data = products.map((p) => productToDto(p));

    return {
      data,
      pagination: { page, pageSize, totalPages, totalItems },
    };
  }

  private async countPublicProducts(providerIds: number[]) {
    const map = new Map<number, number>();
    if (providerIds.length === 0) return map;
    const rows = await this.prisma.product.groupBy({
      by: ['providerId'],
      where: { providerId: { in: providerIds }, ...publicProductWhere },
      _count: { _all: true },
    });
    for (const row of rows) {
      if (row.providerId != null) map.set(row.providerId, row._count._all);
    }
    return map;
  }

  async recommendations() {
    const providers = await this.listPublicInfo({ page: 1, pageSize: 10 });
    return providers;
  }

  private userToProvider(user: any, ap: any, includePhone = false) {
    return {
      id: user.id,
      providerId: user.id,
      brandName: ap.brandName ?? user.name,
      businessName: ap.businessName ?? null,
      firstName: ap.firstName ?? null,
      lastName: ap.lastName ?? null,
      about: ap.about ?? null,
      description: ap.description ?? null,
      city: ap.city ?? null,
      state: ap.state ?? null,
      country: ap.country ?? null,
      address: ap.address ?? null,
      ...(includePhone ? { phone: user.phone ?? null } : {}),
      email: user.email,
      rating: ap.rating ?? 0,
      reviewCount: ap.reviewCount ?? 0,
      verified: ap.verified ?? false,
      featured: ap.featured ?? false,
      estimatedDeliveryDays: ap.estimatedDeliveryDays ?? 7,
      heroImage: ap.heroImage ?? null,
      storeImageUrl: ap.storeImageUrl ?? null,
      coverImageUrl: ap.coverImageUrl ?? null,
      customOrdersEnabled: ap.customOrdersEnabled ?? false,
      isCustomOrderEligible: ap.isCustomOrderEligible ?? ap.customOrdersEnabled ?? false,
      category: ap.category ?? null,
      location: ap.location ?? ap.city ?? null,
      styleTags: splitCsv(ap.styleTags),
      serviceCategories: toStringList(ap.serviceCategories),
    };
  }
}

