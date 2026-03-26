import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { UpdateArtisanProfileDto } from './dto/update-artisan-profile.dto';
import { CreateArtisanProductDto } from './dto/create-artisan-product.dto';
import { UpdateArtisanProductDto } from './dto/update-artisan-product.dto';

function asArrayFromComma(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

@Injectable()
export class ArtisansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private requireArtisan(user: AccessTokenPayload) {
    if (!user || user.role !== 'artisan') {
      throw new ForbiddenException({ message: 'Forbidden', code: 'RESOURCE_NOT_FOUND' });
    }
    return user.sub;
  }

  async getMe(user: AccessTokenPayload) {
    const userId = this.requireArtisan(user);
    const artisanProfile = await this.prisma.artisanProfile.findUnique({ where: { userId } });
    if (!artisanProfile) throw new NotFoundException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });

    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw new NotFoundException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });

    return {
      id: artisanProfile.userId,
      brandName: artisanProfile.brandName ?? u.name,
      firstName: artisanProfile.firstName,
      lastName: artisanProfile.lastName,
      about: artisanProfile.about ?? null,
      city: artisanProfile.city ?? null,
      state: artisanProfile.state ?? null,
      phone: u.phone ?? null,
      email: u.email,
      rating: artisanProfile.rating ?? 0,
      reviewCount: artisanProfile.reviewCount ?? 0,
      verified: artisanProfile.verified ?? false,
      featured: artisanProfile.featured ?? false,
      estimatedDeliveryDays: artisanProfile.estimatedDeliveryDays ?? 7,
      heroImage: artisanProfile.heroImage ?? null,
      customOrdersEnabled: artisanProfile.customOrdersEnabled ?? false,
      category: artisanProfile.category ?? null,
      styleTags: asArrayFromComma(artisanProfile.styleTags),
      serviceCategories: asArrayFromComma(artisanProfile.serviceCategories),
    };
  }

  async patchMe(user: AccessTokenPayload, dto: UpdateArtisanProfileDto) {
    const userId = this.requireArtisan(user);
    const upserted = await this.prisma.artisanProfile.upsert({
      where: { userId },
      create: {
        userId,
        brandName: dto.brandName ?? undefined,
        heroImage: dto.heroImage ?? null,
      },
      update: {
        ...(dto.brandName !== undefined ? { brandName: dto.brandName } : {}),
        ...(dto.about !== undefined ? { about: dto.about } : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.state !== undefined ? { state: dto.state } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.styleTags !== undefined ? { styleTags: dto.styleTags } : {}),
        ...(dto.serviceCategories !== undefined
          ? { serviceCategories: dto.serviceCategories }
          : {}),
        ...(dto.heroImage !== undefined ? { heroImage: dto.heroImage } : {}),
        ...(dto.customOrdersEnabled !== undefined
          ? { customOrdersEnabled: dto.customOrdersEnabled }
          : {}),
        ...(dto.verified !== undefined ? { verified: dto.verified } : {}),
        ...(dto.featured !== undefined ? { featured: dto.featured } : {}),
        ...(dto.estimatedDeliveryDays !== undefined
          ? { estimatedDeliveryDays: dto.estimatedDeliveryDays }
          : {}),
      },
    });

    // return same shape as getMe
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw new NotFoundException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });

    return {
      id: upserted.userId,
      brandName: upserted.brandName ?? u.name,
      firstName: upserted.firstName,
      lastName: upserted.lastName,
      about: upserted.about ?? null,
      city: upserted.city ?? null,
      state: upserted.state ?? null,
      phone: u.phone ?? null,
      email: u.email,
      rating: upserted.rating ?? 0,
      reviewCount: upserted.reviewCount ?? 0,
      verified: upserted.verified ?? false,
      featured: upserted.featured ?? false,
      estimatedDeliveryDays: upserted.estimatedDeliveryDays ?? 7,
      heroImage: upserted.heroImage ?? null,
      customOrdersEnabled: upserted.customOrdersEnabled ?? false,
      category: upserted.category ?? null,
      styleTags: asArrayFromComma(upserted.styleTags),
      serviceCategories: asArrayFromComma(upserted.serviceCategories),
    };
  }

  async listProducts(user: AccessTokenPayload, page: number, pageSize: number) {
    const userId = this.requireArtisan(user);

    const safePage = Math.max(1, page);
    const safePageSize = Math.max(1, Math.min(100, pageSize));

    const totalItems = await this.prisma.product.count({ where: { providerId: userId } });
    const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));

    const items = await this.prisma.product.findMany({
      where: { providerId: userId },
      orderBy: { updatedAt: 'desc' },
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    });

    return {
      data: items.map((p) => this.toProductDto(p)),
      pagination: {
        page: safePage,
        pageSize: safePageSize,
        totalPages,
        totalItems,
      },
    };
  }

  async createProduct(user: AccessTokenPayload, dto: CreateArtisanProductDto) {
    const userId = this.requireArtisan(user);

    const created = await this.prisma.product.create({
      data: {
        providerId: userId,
        name: dto.name,
        description: dto.description ?? null,
        price: dto.price,
        originalPrice: dto.originalPrice ?? null,
        currency: dto.currency ?? 'NGN',
        imageUrl: dto.imageUrl ?? null,
        category: dto.category ?? null,
        materials: dto.materials ?? null,
        tags: dto.tags ?? null,
        featured: dto.featured ?? false,
        isBestSeller: dto.isBestSeller ?? false,
        isTrending: dto.isTrending ?? false,
        isNewArrival: dto.isNewArrival ?? false,
        discountPercent: dto.discountPercent ?? null,
        estimatedDeliveryDays: dto.estimatedDeliveryDays ?? 7,
      },
    });

    return this.toProductDto(created);
  }

  async patchProduct(
    user: AccessTokenPayload,
    productId: number,
    dto: UpdateArtisanProductDto,
  ) {
    const userId = this.requireArtisan(user);

    const existing = await this.prisma.product.findFirst({
      where: { id: productId, providerId: userId },
    });
    if (!existing) {
      throw new NotFoundException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });
    }

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.originalPrice !== undefined ? { originalPrice: dto.originalPrice } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.materials !== undefined ? { materials: dto.materials } : {}),
        ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
        ...(dto.featured !== undefined ? { featured: dto.featured } : {}),
        ...(dto.isBestSeller !== undefined ? { isBestSeller: dto.isBestSeller } : {}),
        ...(dto.isTrending !== undefined ? { isTrending: dto.isTrending } : {}),
        ...(dto.isNewArrival !== undefined ? { isNewArrival: dto.isNewArrival } : {}),
        ...(dto.discountPercent !== undefined ? { discountPercent: dto.discountPercent } : {}),
        ...(dto.estimatedDeliveryDays !== undefined
          ? { estimatedDeliveryDays: dto.estimatedDeliveryDays }
          : {}),
      },
    });

    return this.toProductDto(updated);
  }

  async deleteProduct(user: AccessTokenPayload, productId: number) {
    const userId = this.requireArtisan(user);

    const existing = await this.prisma.product.findFirst({
      where: { id: productId, providerId: userId },
    });
    if (!existing) {
      throw new NotFoundException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });
    }

    await this.prisma.product.delete({ where: { id: productId } });
    return { success: true };
  }

  private toProductDto(p: any) {
    return {
      id: p.id,
      name: p.name,
      description: p.description ?? '',
      priceRange: { min: p.price, max: p.price },
      currency: p.currency,
      estimatedDeliveryDays: p.estimatedDeliveryDays ?? 7,
      materials: p.materials ?? '',
      tags: p.tags ? asArrayFromComma(p.tags) : [],
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
}

