import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { randomUUID } from 'crypto';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';

type CartItem = {
  id: string;
  productId: number;
  productName: string;
  providerId: number | null;
  providerName: string;
  basePrice: number;
  finalPrice: number;
  category: string;
  selectedSize: string;
  selectedBodyType: string | null;
  selectedVariants: {};
  measurements: {};
  notes: string | null;
  quantity: number;
};

// TEMP: in-memory cart until we add DB cart tables.
const cartStore = new Map<number, CartItem[]>();

function splitProviderName(providerProfile: any, user: any) {
  return providerProfile?.brandName ?? user?.name ?? '';
}

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  private getCartForUser(userId: number) {
    const existing = cartStore.get(userId);
    if (existing) return existing;
    const created: CartItem[] = [];
    cartStore.set(userId, created);
    return created;
  }

  async list(user: AccessTokenPayload) {
    const items = this.getCartForUser(user.sub);
    return items;
  }

  async add(user: AccessTokenPayload, body: any) {
    const userId = user.sub;
    const productId = Number(body?.productId ?? body?.id ?? 0);
    const quantity = Math.max(1, Number(body?.quantity ?? 1));
    if (!productId) return { message: 'Missing productId', code: 'VALIDATION_ERROR' };

    const p = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!p) return { message: 'Product not found', code: 'RESOURCE_NOT_FOUND' };

    const provider = p.providerId
      ? await this.prisma.user.findUnique({
          where: { id: p.providerId },
          include: { artisanProfile: true },
        })
      : null;

    const basePrice = typeof body?.basePrice === 'number' ? body.basePrice : p.price;
    const finalPrice =
      typeof body?.finalPrice === 'number' ? body.finalPrice : basePrice;

    const item: CartItem = {
      id: randomUUID(),
      productId: p.id,
      productName: p.name,
      providerId: p.providerId,
      providerName: splitProviderName(provider?.artisanProfile, provider),
      basePrice,
      finalPrice,
      category: p.category ?? '',
      selectedSize: body?.selectedSize ?? 'M',
      selectedBodyType: body?.selectedBodyType ?? null,
      selectedVariants: body?.selectedVariants ?? {},
      measurements: body?.measurements ?? {},
      notes: typeof body?.notes === 'string' ? body.notes : null,
      quantity,
    };

    const cart = this.getCartForUser(userId);
    cart.push(item);
    return item;
  }

  async patch(user: AccessTokenPayload, cartItemId: string, body: any) {
    const userId = user.sub;
    const cart = this.getCartForUser(userId);
    const idx = cart.findIndex((i) => i.id === cartItemId);
    if (idx < 0) return { message: 'Not found', code: 'RESOURCE_NOT_FOUND' };

    const item = cart[idx];
    const quantity = body?.quantity !== undefined ? Math.max(1, Number(body.quantity)) : item.quantity;

    cart[idx] = {
      ...item,
      quantity,
      notes: body?.notes !== undefined ? (typeof body.notes === 'string' ? body.notes : null) : item.notes,
      selectedSize: body?.selectedSize !== undefined ? String(body.selectedSize) : item.selectedSize,
      selectedBodyType:
        body?.selectedBodyType !== undefined ? (body.selectedBodyType as string | null) : item.selectedBodyType,
    };

    return cart[idx];
  }

  async remove(user: AccessTokenPayload, cartItemId: string) {
    const userId = user.sub;
    const cart = this.getCartForUser(userId);
    const idx = cart.findIndex((i) => i.id === cartItemId);
    if (idx < 0) return { message: 'Not found', code: 'RESOURCE_NOT_FOUND' };
    cart.splice(idx, 1);
    return { success: true };
  }

  async clear(user: AccessTokenPayload) {
    const cart = this.getCartForUser(user.sub);
    cart.splice(0, cart.length);
    return { success: true };
  }
}

