import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';

type WishlistItem = {
  id: number;
  customerId: number;
  productId: number;
  productName: string;
  providerId: number;
  providerName: string;
  priceMin: number;
  priceMax: number;
  currency: string;
  category: string | null;
  imageUrl: string | null;
  styleTags: string[];
  addedAt: string;
};

const wishlistStore = new Map<number, WishlistItem[]>();
let wishlistIdSeq = 1;

function splitCsv(value: string | null | undefined): string[] {
  if (!value) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  private list(userId: number) {
    const existing = wishlistStore.get(userId);
    if (existing) return existing;
    const created: WishlistItem[] = [];
    wishlistStore.set(userId, created);
    return created;
  }

  async add(user: AccessTokenPayload, body: any) {
    const userId = user.sub;
    const productId = Number(body?.productId ?? body?.id ?? 0);
    if (!productId) return { message: 'Missing productId', code: 'VALIDATION_ERROR' };

    const p = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!p) return { message: 'Product not found', code: 'RESOURCE_NOT_FOUND' };

    const provider = await this.prisma.user.findUnique({
      where: { id: p.providerId },
      include: { artisanProfile: true },
    });

    const priceMin = typeof body?.priceMin === 'number' ? body.priceMin : p.price;
    const priceMax = typeof body?.priceMax === 'number' ? body.priceMax : p.price;

    const item: WishlistItem = {
      id: wishlistIdSeq++,
      customerId: userId,
      productId: p.id,
      productName: p.name,
      providerId: p.providerId,
      providerName: provider?.artisanProfile?.brandName ?? provider?.name ?? '',
      priceMin,
      priceMax,
      currency: p.currency ?? 'NGN',
      category: p.category ?? null,
      imageUrl: p.imageUrl ?? null,
      styleTags: splitCsv(p.tags),
      addedAt: new Date().toISOString(),
    };

    const list = this.list(userId);
    const existingIdx = list.findIndex((x) => x.productId === productId);
    if (existingIdx >= 0) list.splice(existingIdx, 1, item);
    else list.push(item);

    return item;
  }

  async listAll(user: AccessTokenPayload) {
    return this.list(user.sub);
  }

  async remove(user: AccessTokenPayload, productId: number) {
    const userId = user.sub;
    const list = this.list(userId);
    const idx = list.findIndex((x) => x.productId === productId);
    if (idx < 0) return { message: 'Not found', code: 'RESOURCE_NOT_FOUND' };
    list.splice(idx, 1);
    return { success: true };
  }
}

