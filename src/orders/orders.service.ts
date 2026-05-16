import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { PrismaService } from '../database/prisma.service';
import { validateCustomisationPayload } from '../products/product-customisation.templates';

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
  basePrice: number | null;
  rushSurcharge: number | null;
  rushOrder: boolean;
  customisationData: Record<string, unknown> | null;
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

  private toOrderResponse(dbOrder: {
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
    basePrice: number | null;
    rushSurcharge: number | null;
    rushOrder: boolean;
    customisationData: unknown;
    currency: string;
    paymentMethod: string;
    paymentReference: string | null;
    paymentStatus: string;
    shippingFirstName: string | null;
    shippingLastName: string | null;
    shippingPhone: string | null;
    shippingAddressLine1: string | null;
    shippingAddressLine2: string | null;
    shippingCity: string | null;
    shippingState: string | null;
    shippingCountry: string | null;
    shippingPostalCode: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Order {
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
      basePrice: dbOrder.basePrice,
      rushSurcharge: dbOrder.rushSurcharge,
      rushOrder: dbOrder.rushOrder,
      customisationData: (dbOrder.customisationData as Record<string, unknown>) ?? null,
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

  async list(user: AccessTokenPayload, query: Record<string, unknown>) {
    const page = Math.max(1, Number(query?.page ?? 1));
    const pageSize = Math.max(1, Math.min(100, Number(query?.pageSize ?? 20)));
    const status = typeof query?.status === 'string' ? query.status : undefined;
    const isCustomOrder =
      query?.isCustomOrder === 'true' ? true : query?.isCustomOrder === 'false' ? false : undefined;

    const where: Record<string, unknown> = { customerId: user.sub };
    if (status) where.status = status;
    if (isCustomOrder !== undefined) where.isCustomOrder = isCustomOrder;

    const totalItems = await this.prisma.order.count({ where });
    const skip = (page - 1) * pageSize;

    const items = await this.prisma.order.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: items.map((item) => this.toOrderResponse(item)),
      total: totalItems,
    };
  }

  async getById(user: AccessTokenPayload, orderId: string) {
    const dbOrder = await this.prisma.order.findUnique({
      where: { id: Number(orderId) },
    });
    if (!dbOrder || dbOrder.customerId !== user.sub) return null;
    return this.toOrderResponse(dbOrder);
  }

  async create(user: AccessTokenPayload, body: Record<string, unknown>) {
    const customerId = user.sub;
    const items = Array.isArray(body?.items) ? body.items : [];
    if (items.length === 0) {
      return { message: 'Missing items', code: 'VALIDATION_ERROR' };
    }

    const first = items[0] as Record<string, unknown>;
    const productId = Number(first.productId);
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) return { message: 'Product not found', code: 'RESOURCE_NOT_FOUND' };

    const provider = product.providerId
      ? await this.prisma.user.findUnique({
          where: { id: product.providerId },
          include: { artisanProfile: true },
        })
      : null;

    const artisanProfile = provider?.artisanProfile;
    const rushOrder = Boolean(first.rushOrder ?? body.rushOrder ?? false);

    if (rushOrder && !artisanProfile?.rushOrderEnabled) {
      throw new BadRequestException({
        message: 'Rush order is not available for this artisan',
        code: 'RUSH_ORDER_NOT_AVAILABLE',
      });
    }

    const basePrice =
      typeof first.basePrice === 'number'
        ? first.basePrice
        : typeof first.finalPrice === 'number'
          ? first.finalPrice
          : (product.price ?? 0);

    const surchargePercent = artisanProfile?.rushOrderSurchargePercent ?? 25;
    const rushSurcharge = rushOrder ? basePrice * (surchargePercent / 100) : 0;
    const finalPrice = basePrice + rushSurcharge;

    const customisationData =
      (first.customisation as Record<string, unknown>) ??
      (first.customization as Record<string, unknown>) ??
      null;

    if (customisationData && product.category) {
      const validation = validateCustomisationPayload(
        product.category,
        customisationData,
      );
      if (!validation.valid) {
        throw new BadRequestException({
          message: `Unknown customisation keys: ${validation.unknownKeys.join(', ')}`,
          code: 'INVALID_CUSTOMISATION',
        });
      }
    }

    const shippingAddress = (body.shippingAddress ?? {}) as ShippingAddress;

    const dbOrder = await this.prisma.order.create({
      data: {
        customerId,
        productId: product.id,
        productName: product.name,
        productImage: product.imageUrl ?? product.images?.[0] ?? null,
        providerId: product.providerId,
        providerName: artisanProfile?.brandName ?? provider?.name ?? '',
        customizationId: null,
        isCustomOrder: Boolean(customisationData),
        status: 'pending',
        basePrice,
        rushSurcharge: rushOrder ? rushSurcharge : null,
        rushOrder,
        price: finalPrice,
        customisationData: customisationData
          ? (customisationData as object)
          : undefined,
        currency: typeof body.currency === 'string' ? body.currency : product.currency ?? 'NGN',
        shippingFirstName: shippingAddress.firstName,
        shippingLastName: shippingAddress.lastName,
        shippingPhone: shippingAddress.phone,
        shippingAddressLine1: shippingAddress.addressLine1,
        shippingAddressLine2: shippingAddress.addressLine2,
        shippingCity: shippingAddress.city,
        shippingState: shippingAddress.state,
        shippingCountry: shippingAddress.country,
        shippingPostalCode: shippingAddress.postalCode,
        paymentMethod: typeof body.paymentMethod === 'string' ? body.paymentMethod : 'bank_transfer',
        paymentReference: null,
        paymentStatus: 'unpaid',
      },
    });

    return this.toOrderResponse(dbOrder);
  }

  async patch(user: AccessTokenPayload, orderId: string, body: Record<string, unknown>) {
    const dbOrder = await this.prisma.order.findUnique({
      where: { id: Number(orderId) },
    });
    if (!dbOrder || dbOrder.customerId !== user.sub) return null;

    const updated = await this.prisma.order.update({
      where: { id: Number(orderId) },
      data: {
        ...(typeof body?.status === 'string' ? { status: body.status } : {}),
        ...(typeof body?.paymentReference === 'string'
          ? { paymentReference: body.paymentReference }
          : {}),
        ...(typeof body?.paymentStatus === 'string' ? { paymentStatus: body.paymentStatus } : {}),
        ...(typeof body?.paymentMethod === 'string' ? { paymentMethod: body.paymentMethod } : {}),
      },
    });

    return this.toOrderResponse(updated);
  }
}
