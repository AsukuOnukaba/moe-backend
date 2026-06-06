import { BadRequestException, Injectable } from '@nestjs/common';
import { activeProductWhere } from '../common/active-product';
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
  selectedVariants: Record<string, unknown>;
  measurements: Record<string, unknown>;
  customisation: Record<string, unknown> | null;
  notes: string | null;
  quantity: number;
};

const cartStore = new Map<number, CartItem[]>();

function splitProviderName(providerProfile: { brandName?: string | null } | null, user: { name?: string } | null) {
  return providerProfile?.brandName ?? user?.name ?? '';
}

function hasCustomisationPayload(body: Record<string, unknown>): boolean {
  const customisation = body.customisation ?? body.customization;
  if (customisation && typeof customisation === 'object' && Object.keys(customisation as object).length > 0) {
    return true;
  }
  const measurements = body.measurements;
  if (measurements && typeof measurements === 'object' && Object.keys(measurements as object).length > 0) {
    return true;
  }
  const selectedVariants = body.selectedVariants;
  if (selectedVariants && typeof selectedVariants === 'object' && Object.keys(selectedVariants as object).length > 0) {
    return true;
  }
  return Boolean(body.selectedSize || body.selectedBodyType);
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
    return this.getCartForUser(user.sub);
  }

  async add(user: AccessTokenPayload, body: Record<string, unknown>) {
    const userId = user.sub;
    const productId = Number(body?.productId ?? body?.id ?? 0);
    const quantity = Math.max(1, Number(body?.quantity ?? 1));
    if (!productId) {
      throw new BadRequestException({ message: 'Missing productId', code: 'VALIDATION_ERROR' });
    }

    const p = await this.prisma.product.findFirst({
      where: { id: productId, ...activeProductWhere },
    });
    if (!p) {
      throw new BadRequestException({ message: 'Product not found', code: 'RESOURCE_NOT_FOUND' });
    }

    if (p.customisationRequired && !hasCustomisationPayload(body)) {
      throw new BadRequestException({
        message: 'Customisation is required for this product',
        code: 'CUSTOMISATION_REQUIRED',
      });
    }

    const provider = p.providerId
      ? await this.prisma.user.findUnique({
          where: { id: p.providerId },
          include: { artisanProfile: true },
        })
      : null;

    const basePrice = typeof body?.basePrice === 'number' ? body.basePrice : (p.price ?? 0);
    const finalPrice = typeof body?.finalPrice === 'number' ? body.finalPrice : basePrice;

    const item: CartItem = {
      id: randomUUID(),
      productId: p.id,
      productName: p.name,
      providerId: p.providerId,
      providerName: splitProviderName(provider?.artisanProfile ?? null, provider),
      basePrice,
      finalPrice,
      category: p.category ?? '',
      selectedSize: typeof body?.selectedSize === 'string' ? body.selectedSize : 'M',
      selectedBodyType: (body?.selectedBodyType as string | null) ?? null,
      selectedVariants: (body?.selectedVariants as Record<string, unknown>) ?? {},
      measurements: (body?.measurements as Record<string, unknown>) ?? {},
      customisation:
        (body?.customisation as Record<string, unknown>) ??
        (body?.customization as Record<string, unknown>) ??
        null,
      notes: typeof body?.notes === 'string' ? body.notes : null,
      quantity,
    };

    const cart = this.getCartForUser(userId);
    cart.push(item);
    return item;
  }

  async patch(user: AccessTokenPayload, cartItemId: string, body: Record<string, unknown>) {
    const cart = this.getCartForUser(user.sub);
    const idx = cart.findIndex((i) => i.id === cartItemId);
    if (idx < 0) {
      throw new BadRequestException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });
    }

    const item = cart[idx];
    cart[idx] = {
      ...item,
      quantity: body?.quantity !== undefined ? Math.max(1, Number(body.quantity)) : item.quantity,
      notes: body?.notes !== undefined ? (typeof body.notes === 'string' ? body.notes : null) : item.notes,
      selectedSize:
        body?.selectedSize !== undefined ? String(body.selectedSize) : item.selectedSize,
      selectedBodyType:
        body?.selectedBodyType !== undefined
          ? (body.selectedBodyType as string | null)
          : item.selectedBodyType,
    };

    return cart[idx];
  }

  async remove(user: AccessTokenPayload, cartItemId: string) {
    const cart = this.getCartForUser(user.sub);
    const idx = cart.findIndex((i) => i.id === cartItemId);
    if (idx < 0) {
      throw new BadRequestException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });
    }
    cart.splice(idx, 1);
    return { success: true };
  }

  async clear(user: AccessTokenPayload) {
    const cart = this.getCartForUser(user.sub);
    cart.splice(0, cart.length);
    return { success: true };
  }

  purgeProductFromAllCarts(productId: number) {
    let removed = 0;
    for (const cart of cartStore.values()) {
      for (let i = cart.length - 1; i >= 0; i--) {
        if (cart[i].productId === productId) {
          cart.splice(i, 1);
          removed++;
        }
      }
    }
    return removed;
  }
}
