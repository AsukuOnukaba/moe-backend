import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';

function splitCsv(value: string | null | undefined): string[] {
  if (!value) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

export interface WishlistItemResponse {
  id: number;
  productId: number;
  productName: string;
  providerId: number | null;
  providerName: string;
  price: number | null;
  currency: string;
  category: string | null;
  imageUrl: string | null;
  styleTags: string[];
  addedAt: Date;
}

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  async add(user: AccessTokenPayload, body: any) {
    const userId = user.sub;
    const productId = Number(body?.productId ?? body?.id ?? 0);
    if (!productId) {
      throw new BadRequestException({ message: 'Missing productId' });
    }

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { provider: { include: { artisanProfile: true } } },
    });

    if (!product) {
      throw new BadRequestException({ message: 'Product not found' });
    }

    // Check if already in wishlist
    const existing = await this.prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId, productId } },
    });

    // If already exists, just return it
    if (existing) {
      return this.formatWishlistItem(product, existing);
    }

    // Add to wishlist
    const wishlistItem = await this.prisma.wishlistItem.create({
      data: {
        userId,
        productId,
      },
    });

    return this.formatWishlistItem(product, wishlistItem);
  }

  async listAll(user: AccessTokenPayload) {
    const userId = user.sub;

    const items = await this.prisma.wishlistItem.findMany({
      where: { userId },
      include: {
        product: {
          include: { provider: { include: { artisanProfile: true } } },
        },
      },
      orderBy: { addedAt: 'desc' },
    });

    const data = items.map((item) => this.formatWishlistItem(item.product, item));

    return {
      data,
      total: data.length,
    };
  }

  async remove(user: AccessTokenPayload, productId: number) {
    const userId = user.sub;

    const existing = await this.prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId, productId } },
    });

    if (!existing) {
      throw new BadRequestException({ message: 'Not found' });
    }

    await this.prisma.wishlistItem.delete({
      where: { userId_productId: { userId, productId } },
    });

    return null;
  }

  private formatWishlistItem(
    product: any,
    wishlistItem: any,
  ): WishlistItemResponse {
    const provider = product.provider;
    const providerName =
      provider?.artisanProfile?.brandName || provider?.name || 'Unknown';

    return {
      id: wishlistItem.id,
      productId: product.id,
      productName: product.name,
      providerId: product.providerId,
      providerName: providerName,
      price: product.price ?? null,
      currency: product.currency ?? 'NGN',
      category: product.category ?? null,
      imageUrl: product.imageUrl ?? (product.images?.[0] ?? null),
      styleTags: splitCsv(product.tags),
      addedAt: wishlistItem.addedAt,
    };
  }
}


