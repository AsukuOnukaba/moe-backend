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
  id: number;
  customerId: number;
  productId: number;
  productName: string | null;
  productImage: string | null;
  providerId: number | null;
  providerName: string | null;
  customizationId: number | null;
  isCustomOrder: boolean;
  status: string;
  price: number | null;
  currency: string;
  shippingAddress: ShippingAddress;
  paymentMethod: string;
  paymentReference: string | null;
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  private toOrderResponse(dbOrder: any): Order {
    return {
      id: dbOrder.id,
      customerId: dbOrder.customerId,
      productId: dbOrder.productId,
      productName: dbOrder.productName,
      productImage: dbOrder.productImage,
      providerId: dbOrder.providerId,
      providerName: dbOrder.providerName,
      customizationId: dbOrder.customizationId,
      isCustomOrder: dbOrder.isCustomOrder,
      status: dbOrder.status,
      price: dbOrder.price,
      currency: dbOrder.currency,
      shippingAddress: {
        firstName: dbOrder.shippingFirstName || '',
        lastName: dbOrder.shippingLastName || '',
        phone: dbOrder.shippingPhone || '',
        addressLine1: dbOrder.shippingAddressLine1 || '',
        addressLine2: dbOrder.shippingAddressLine2,
        city: dbOrder.shippingCity || '',
        state: dbOrder.shippingState || '',
        country: dbOrder.shippingCountry || '',
        postalCode: dbOrder.shippingPostalCode,
      },
      paymentMethod: dbOrder.paymentMethod,
      paymentReference: dbOrder.paymentReference,
      paymentStatus: dbOrder.paymentStatus,
      createdAt: dbOrder.createdAt.toISOString(),
      updatedAt: dbOrder.updatedAt.toISOString(),
    };
  }

  async list(user: AccessTokenPayload, query: any) {
    const page = Math.max(1, Number(query?.page ?? 1));
    const pageSize = Math.max(1, Math.min(100, Number(query?.pageSize ?? 20)));
    const status = typeof query?.status === 'string' ? query.status : undefined;
    const isCustomOrder =
      query?.isCustomOrder === 'true' ? true : query?.isCustomOrder === 'false' ? false : undefined;

    const where: any = { customerId: user.sub };
    if (status) where.status = status;
    if (isCustomOrder !== undefined) where.isCustomOrder = isCustomOrder;

    const totalItems = await this.prisma.order.count({ where });
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const skip = (page - 1) * pageSize;

    const items = await this.prisma.order.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: items.map((item) => this.toOrderResponse(item)),
      pagination: { page, pageSize, totalPages, totalItems },
    };
  }

  async getById(user: AccessTokenPayload, orderId: string) {
    const dbOrder = await this.prisma.order.findUnique({
      where: { id: Number(orderId) },
    });
    if (!dbOrder || dbOrder.customerId !== user.sub) return null;
    return this.toOrderResponse(dbOrder);
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

    const provider = product.providerId
      ? await this.prisma.user.findUnique({
          where: { id: product.providerId },
          include: { artisanProfile: true },
        })
      : null;

    const providerName = provider?.artisanProfile?.brandName ?? provider?.name ?? '';
    const shippingAddress: ShippingAddress = body?.shippingAddress ?? ({} as any);

    // Create order and snapshot address fields
    const dbOrder = await this.prisma.order.create({
      data: {
        customerId,
        productId: product.id,
        productName: product.name,
        productImage: product.imageUrl,
        providerId: product.providerId,
        providerName,
        customizationId: null,
        isCustomOrder: false,
        status: 'pending',
        price: typeof first.finalPrice === 'number' ? first.finalPrice : product.price,
        currency: body?.currency ?? product.currency ?? 'NGN',
        shippingFirstName: shippingAddress.firstName,
        shippingLastName: shippingAddress.lastName,
        shippingPhone: shippingAddress.phone,
        shippingAddressLine1: shippingAddress.addressLine1,
        shippingAddressLine2: shippingAddress.addressLine2,
        shippingCity: shippingAddress.city,
        shippingState: shippingAddress.state,
        shippingCountry: shippingAddress.country,
        shippingPostalCode: shippingAddress.postalCode,
        paymentMethod: body?.paymentMethod ?? 'bank_transfer',
        paymentReference: null,
        paymentStatus: 'unpaid',
      },
    });

    return this.toOrderResponse(dbOrder);
  }

  async patch(user: AccessTokenPayload, orderId: string, body: any) {
    const dbOrder = await this.prisma.order.findUnique({
      where: { id: Number(orderId) },
    });
    if (!dbOrder || dbOrder.customerId !== user.sub) return null;

    const updated = await this.prisma.order.update({
      where: { id: Number(orderId) },
      data: {
        ...(typeof body?.status === 'string' ? { status: body.status } : {}),
        ...(typeof body?.paymentReference === 'string' ? { paymentReference: body.paymentReference } : {}),
        ...(typeof body?.paymentStatus === 'string' ? { paymentStatus: body.paymentStatus } : {}),
        ...(typeof body?.paymentMethod === 'string' ? { paymentMethod: body.paymentMethod } : {}),
      },
    });

    return this.toOrderResponse(updated);
  }
}

