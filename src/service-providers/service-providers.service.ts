import { Injectable, NotFoundException } from '@nestjs/common';
import { activeProductWhere } from '../common/active-product';
import { PrismaService } from '../database/prisma.service';
import { productToDto, toTagArray } from '../common/product-mapper';

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
      .map((u: any) => this.userToProvider(u, u.artisanProfile));

    if (category) {
      providers = providers.filter(
        (p) => p.category?.toLowerCase() === category.toLowerCase(),
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
    if (serviceCategories.length > 0) {
      providers = providers.filter((p) =>
        serviceCategories.some((sc: string) =>
          p.serviceCategories.some(
            (existing: string) => existing.toLowerCase() === sc.toLowerCase(),
          ),
        ),
      );
    }

    const totalItems = providers.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const pageItems = providers.slice(skip, skip + pageSize);

    return {
      data: pageItems,
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
    return this.userToProvider(user, user.artisanProfile);
  }

  async listProductsByProvider(providerId: number, query: any) {
    const products = await this.prisma.product.findMany({
      where: { providerId, status: 'approved', ...activeProductWhere },
      orderBy: { updatedAt: 'desc' },
      skip: (Math.max(1, Number(query?.page ?? 1)) - 1) * Math.max(1, Number(query?.pageSize ?? 20)),
      take: Math.max(1, Number(query?.pageSize ?? 20)),
    });

    const page = Math.max(1, Number(query?.page ?? 1));
    const pageSize = Math.max(1, Number(query?.pageSize ?? 20));
    const totalItems = await this.prisma.product.count({
      where: { providerId, status: 'approved', ...activeProductWhere },
    });
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    const data = products.map((p) => productToDto(p));

    return {
      data,
      pagination: { page, pageSize, totalPages, totalItems },
    };
  }

  async recommendations() {
    const providers = await this.listPublicInfo({ page: 1, pageSize: 10 });
    return providers;
  }

  private userToProvider(user: any, ap: any) {
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
      phone: user.phone ?? null,
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
      category: ap.category ?? null,
      location: ap.location ?? ap.city ?? null,
      styleTags: splitCsv(ap.styleTags),
      serviceCategories: splitCsv(ap.serviceCategories),
    };
  }
}

