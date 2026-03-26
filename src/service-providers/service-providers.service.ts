import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { MoeRole } from '../auth/types/jwt-payload';

function splitCsv(value: string | null | undefined): string[] {
  if (!value) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

@Injectable()
export class ServiceProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublicInfo(query: any) {
    const page = Math.max(1, Number(query?.page ?? 1));
    const pageSize = Math.max(1, Math.min(100, Number(query?.pageSize ?? 20)));
    const skip = (page - 1) * pageSize;

    // TEMP: treat artisan users as "providers".
    const artisans = await this.prisma.userRole.findMany({
      where: { role: { name: 'artisan' } },
      include: { user: { include: { artisanProfile: true } } },
      take: 1000,
    });

    const providers = artisans
      .map((ur) => ur.user)
      .filter((u: any) => u.artisanProfile)
      .map((u: any) => this.userToProvider(u, u.artisanProfile));

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
    if (!user || !user.artisanProfile) {
      throw new NotFoundException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });
    }
    return this.userToProvider(user, user.artisanProfile);
  }

  async listProductsByProvider(providerId: number, query: any) {
    const products = await this.prisma.product.findMany({
      where: { providerId },
      orderBy: { updatedAt: 'desc' },
      skip: (Math.max(1, Number(query?.page ?? 1)) - 1) * Math.max(1, Number(query?.pageSize ?? 20)),
      take: Math.max(1, Number(query?.pageSize ?? 20)),
    });

    const page = Math.max(1, Number(query?.page ?? 1));
    const pageSize = Math.max(1, Number(query?.pageSize ?? 20));
    const totalItems = await this.prisma.product.count({ where: { providerId } });
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    const data = products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? '',
      priceRange: { min: p.price, max: p.price },
      currency: p.currency ?? 'NGN',
      estimatedDeliveryDays: p.estimatedDeliveryDays ?? 7,
      materials: p.materials ?? '',
      tags: splitCsv(p.tags),
      images: p.imageUrl ? [p.imageUrl] : [],
      category: p.category ?? null,
      providerId: p.providerId,
      featured: p.featured ?? false,
      isBestSeller: p.isBestSeller ?? false,
      isTrending: p.isTrending ?? false,
      isNewArrival: p.isNewArrival ?? false,
      discountPercent: p.discountPercent ?? null,
      originalPrice: p.originalPrice ?? null,
    }));

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
      brandName: ap.brandName ?? user.name,
      firstName: ap.firstName ?? null,
      lastName: ap.lastName ?? null,
      about: ap.about ?? null,
      city: ap.city ?? null,
      state: ap.state ?? null,
      phone: user.phone ?? null,
      email: user.email,
      rating: ap.rating ?? 0,
      reviewCount: ap.reviewCount ?? 0,
      verified: ap.verified ?? false,
      featured: ap.featured ?? false,
      estimatedDeliveryDays: ap.estimatedDeliveryDays ?? 7,
      heroImage: ap.heroImage ?? null,
      customOrdersEnabled: ap.customOrdersEnabled ?? false,
      category: ap.category ?? null,
      styleTags: splitCsv(ap.styleTags),
      serviceCategories: splitCsv(ap.serviceCategories),
    };
  }
}

