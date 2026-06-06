import { BadRequestException, Injectable } from '@nestjs/common';
import { activeProductWhere } from '../common/active-product';
import { PrismaService } from '../database/prisma.service';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { productToDto } from '../common/product-mapper';

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  async addByProductId(user: AccessTokenPayload, productId: number) {
    if (!productId) {
      throw new BadRequestException({ message: 'Missing productId' });
    }
    return this.add(user, { productId });
  }

  async add(user: AccessTokenPayload, body: { productId?: number; id?: number }) {
    const userId = user.sub;
    const productId = Number(body?.productId ?? body?.id ?? 0);
    if (!productId) {
      throw new BadRequestException({ message: 'Missing productId' });
    }

    const product = await this.prisma.product.findFirst({
      where: { id: productId, ...activeProductWhere },
    });
    if (!product) {
      throw new BadRequestException({ message: 'Product not found' });
    }

    const existing = await this.prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId, productId } },
    });

    if (existing) {
      const withProduct = await this.prisma.wishlistItem.findUnique({
        where: { userId_productId: { userId, productId } },
        include: this.itemInclude(),
      });
      return this.toWishlistItemDto(withProduct!);
    }

    const created = await this.prisma.wishlistItem.create({
      data: { userId, productId },
      include: this.itemInclude(),
    });
    return this.toWishlistItemDto(created);
  }

  private itemInclude() {
    return {
      product: {
        include: {
          provider: { include: { artisanProfile: true } },
        },
      },
    } as const;
  }

  private resolveProviderName(product: {
    provider?: {
      name: string;
      artisanProfile?: { brandName: string | null } | null;
    } | null;
  }) {
    const provider = product.provider;
    if (!provider) return null;
    return provider.artisanProfile?.brandName ?? provider.name;
  }

  private toWishlistItemDto(item: {
    id: number;
    productId: number;
    addedAt: Date;
    product: Parameters<WishlistService['resolveProviderName']>[0] & Parameters<typeof productToDto>[0];
  }) {
    const providerName = this.resolveProviderName(item.product);
    return {
      wishlistItemId: item.id,
      productId: item.productId,
      addedAt: item.addedAt.toISOString(),
      providerName,
      artisanName: providerName,
      ...productToDto(item.product),
    };
  }

  async listFullProducts(user: AccessTokenPayload) {
    const userId = user.sub;
    const items = await this.prisma.wishlistItem.findMany({
      where: { userId, product: activeProductWhere },
      include: this.itemInclude(),
      orderBy: { addedAt: 'desc' },
    });

    return {
      data: items.map((item) => this.toWishlistItemDto(item)),
      total: items.length,
    };
  }

  async listAll(user: AccessTokenPayload) {
    return this.listFullProducts(user);
  }

  /**
   * Removes a wishlist entry by productId or wishlistItemId.
   * Idempotent — succeeds with no error when the item is already gone.
   */
  async remove(user: AccessTokenPayload, id: number) {
    const userId = user.sub;
    if (!Number.isFinite(id) || id <= 0) {
      throw new BadRequestException({
        message: 'Invalid id',
        code: 'VALIDATION_ERROR',
      });
    }

    const byProduct = await this.prisma.wishlistItem.deleteMany({
      where: { userId, productId: id },
    });
    if (byProduct.count > 0) return;

    await this.prisma.wishlistItem.deleteMany({
      where: { userId, id },
    });
  }

  async removeByWishlistItemId(user: AccessTokenPayload, wishlistItemId: number) {
    return this.remove(user, wishlistItemId);
  }
}
