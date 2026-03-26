import { Injectable } from '@nestjs/common';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { PrismaService } from '../database/prisma.service';

type ShippingAddress = {
  firstName: string;
  lastName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  country: string;
  postalCode?: string | null;
};

type Order = {
  id: string;
  customerId: number;
  productId: number;
  productName: string;
  productImage: string;
  providerId: number;
  providerName: string;
  customizationId: number | null;
  isCustomOrder: boolean;
  status: 'pending' | 'awaiting_payment' | 'in_progress' | 'completed' | 'cancelled';
  price: number;
  currency: string;
  shippingAddress: ShippingAddress;
  paymentMethod: string;
  paymentReference: string | null;
  paymentStatus: 'unpaid' | 'paid' | 'refunded';
  createdAt: string;
  updatedAt: string;
};

// TEMP: in-memory orders until DB models are added.
const orderStore = new Map<number, Order[]>();
let orderIdSeq = 1;

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  private getOrdersForUser(userId: number) {
    const existing = orderStore.get(userId);
    if (existing) return existing;
    const created: Order[] = [];
    orderStore.set(userId, created);
    return created;
  }

  async list(user: AccessTokenPayload, query: any) {
    const page = Math.max(1, Number(query?.page ?? 1));
    const pageSize = Math.max(1, Math.min(100, Number(query?.pageSize ?? 20)));
    const status = typeof query?.status === 'string' ? query.status : undefined;
    const isCustomOrder =
      query?.isCustomOrder === 'true' ? true : query?.isCustomOrder === 'false' ? false : undefined;

    let items = this.getOrdersForUser(user.sub);
    if (status) items = items.filter((o) => o.status === status);
    if (isCustomOrder !== undefined) items = items.filter((o) => o.isCustomOrder === isCustomOrder);

    const totalItems = items.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const skip = (page - 1) * pageSize;
    const pageItems = items.slice(skip, skip + pageSize);

    return {
      data: pageItems,
      pagination: { page, pageSize, totalPages, totalItems },
    };
  }

  async getById(user: AccessTokenPayload, orderId: string) {
    const items = this.getOrdersForUser(user.sub);
    const found = items.find((o) => o.id === orderId);
    return found ?? null;
  }

  async create(user: AccessTokenPayload, body: any) {
    const customerId = user.sub;
    const items = Array.isArray(body?.items) ? body.items : [];
    if (items.length === 0) {
      return { message: 'Missing items', code: 'VALIDATION_ERROR' };
    }

    const first = items[0];
    const productId = Number(first.productId);
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) return { message: 'Product not found', code: 'RESOURCE_NOT_FOUND' };

    const provider = await this.prisma.user.findUnique({
      where: { id: product.providerId },
      include: { artisanProfile: true },
    });

    const providerName = provider?.artisanProfile?.brandName ?? provider?.name ?? '';

    const shippingAddress: ShippingAddress = body?.shippingAddress ?? ({} as any);

    const order: Order = {
      id: `ORD-${orderIdSeq++}`,
      customerId,
      productId: product.id,
      productName: product.name,
      productImage: product.imageUrl ?? '',
      providerId: product.providerId,
      providerName,
      customizationId: null,
      isCustomOrder: false,
      status: 'pending',
      price: typeof first.finalPrice === 'number' ? first.finalPrice : product.price,
      currency: body?.currency ?? product.currency ?? 'NGN',
      shippingAddress,
      paymentMethod: body?.paymentMethod ?? 'bank_transfer',
      paymentReference: null,
      paymentStatus: 'unpaid',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const orders = this.getOrdersForUser(customerId);
    orders.unshift(order);
    return order;
  }

  async patch(user: AccessTokenPayload, orderId: string, body: any) {
    const items = this.getOrdersForUser(user.sub);
    const idx = items.findIndex((o) => o.id === orderId);
    if (idx < 0) return null;

    const existing = items[idx];
    const next: Order = {
      ...existing,
      ...(typeof body?.status === 'string' ? { status: body.status } : {}),
      ...(typeof body?.paymentReference === 'string' ? { paymentReference: body.paymentReference } : {}),
      ...(typeof body?.paymentStatus === 'string'
        ? { paymentStatus: body.paymentStatus as Order['paymentStatus'] }
        : {}),
      ...(typeof body?.paymentMethod === 'string' ? { paymentMethod: body.paymentMethod } : {}),
      updatedAt: new Date().toISOString(),
    };

    items[idx] = next;
    return next;
  }
}

