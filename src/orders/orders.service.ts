import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentMethodsService } from '../payments/payment-methods.service';
import {
  CheckoutPaymentMethod,
  CreateOrderDto,
} from './dto/create-order.dto';
import { validateCustomisationPayload } from '../products/product-customisation.templates';

type ShippingAddress = {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
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
  paymentMethodId: string | null;
  paymentReference: string | null;
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly paymentMethods: PaymentMethodsService,
  ) {}

  private normalizeShippingAddress(
    raw: CreateOrderDto['shippingAddress'],
  ): ShippingAddress {
    const addressLine1 = raw.address ?? raw.addressLine1 ?? '';
    return {
      firstName: raw.firstName.trim(),
      lastName: raw.lastName.trim(),
      phone: raw.phone.trim(),
      address: addressLine1.trim(),
      addressLine1: addressLine1.trim(),
      addressLine2: raw.addressLine2?.trim() ?? null,
      city: raw.city.trim(),
      state: raw.state.trim(),
      country: raw.country.trim(),
      postalCode: raw.postalCode?.trim() ?? null,
    };
  }

  private resolveShippingForResponse(dbOrder: {
    shippingAddress: unknown;
    shippingFirstName: string | null;
    shippingLastName: string | null;
    shippingPhone: string | null;
    shippingAddressLine1: string | null;
    shippingAddressLine2: string | null;
    shippingCity: string | null;
    shippingState: string | null;
    shippingCountry: string | null;
    shippingPostalCode: string | null;
  }): ShippingAddress {
    const stored = dbOrder.shippingAddress as ShippingAddress | null;
    if (stored && typeof stored === 'object' && stored.firstName) {
      return {
        firstName: stored.firstName,
        lastName: stored.lastName,
        phone: stored.phone,
        address: stored.address ?? stored.addressLine1 ?? '',
        addressLine1: stored.addressLine1 ?? stored.address ?? '',
        addressLine2: stored.addressLine2 ?? null,
        city: stored.city,
        state: stored.state,
        country: stored.country,
        postalCode: stored.postalCode ?? null,
      };
    }
    return {
      firstName: dbOrder.shippingFirstName || '',
      lastName: dbOrder.shippingLastName || '',
      phone: dbOrder.shippingPhone || '',
      address: dbOrder.shippingAddressLine1 || '',
      addressLine1: dbOrder.shippingAddressLine1 || '',
      addressLine2: dbOrder.shippingAddressLine2,
      city: dbOrder.shippingCity || '',
      state: dbOrder.shippingState || '',
      country: dbOrder.shippingCountry || '',
      postalCode: dbOrder.shippingPostalCode,
    };
  }

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
    paymentMethodId: string | null;
    paymentReference: string | null;
    paymentStatus: string;
    shippingAddress: unknown;
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
      shippingAddress: this.resolveShippingForResponse(dbOrder),
      paymentMethod: dbOrder.paymentMethod,
      paymentMethodId: dbOrder.paymentMethodId,
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

  async create(user: AccessTokenPayload, body: CreateOrderDto) {
    const customerId = user.sub;
    const items = body.items ?? [];
    if (items.length === 0) {
      throw new BadRequestException({
        message: 'Missing items',
        code: 'VALIDATION_ERROR',
      });
    }

    const paymentMethod = body.paymentMethod;
    const paymentMethodId = body.paymentMethodId?.trim() || null;
    const gatewayToken = body.gatewayToken?.trim() || null;

    if (paymentMethod === CheckoutPaymentMethod.CARD) {
      if (!paymentMethodId && !gatewayToken) {
        throw new BadRequestException({
          message: 'paymentMethodId or gatewayToken is required for card payments',
          code: 'VALIDATION_ERROR',
        });
      }
    }

    if (body.saveCard && !paymentMethodId) {
      if (!gatewayToken) {
        throw new BadRequestException({
          message: 'gatewayToken is required to save a new card',
          code: 'VALIDATION_ERROR',
        });
      }
      if (!body.cardBrand || !body.cardLast4 || !body.cardExpiry) {
        throw new BadRequestException({
          message: 'cardBrand, cardLast4, and cardExpiry are required when saveCard is true',
          code: 'VALIDATION_ERROR',
        });
      }
    }

    let resolvedPaymentMethodId = paymentMethodId;
    let paymentReference: string | null = gatewayToken;

    if (paymentMethod === CheckoutPaymentMethod.CARD && paymentMethodId) {
      await this.paymentMethods.assertOwnedByUser(paymentMethodId, customerId);
    }

    const shippingAddress = this.normalizeShippingAddress(body.shippingAddress);

    const first = items[0];
    const productId = Number(first.productId);
    if (!Number.isFinite(productId)) {
      throw new BadRequestException({
        message: 'Invalid productId',
        code: 'VALIDATION_ERROR',
      });
    }

    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
    });
    if (!product) {
      throw new NotFoundException({
        message: 'Product not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

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
      first.customisation ?? first.customization ?? null;

    if (customisationData && product.category) {
      const validation = validateCustomisationPayload(
        product.category,
        customisationData,
      );
      if (!validation.valid) {
        const parts: string[] = [];
        if (validation.unknownKeys.length) {
          parts.push(`unknown keys: ${validation.unknownKeys.join(', ')}`);
        }
        if (validation.missingRequired.length) {
          parts.push(`missing required: ${validation.missingRequired.join(', ')}`);
        }
        throw new BadRequestException({
          message: `Invalid customisation (${parts.join('; ')})`,
          code: 'INVALID_CUSTOMISATION',
        });
      }
    }

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
        currency: body.currency ?? product.currency ?? 'NGN',
        shippingAddress: shippingAddress as object,
        shippingFirstName: shippingAddress.firstName,
        shippingLastName: shippingAddress.lastName,
        shippingPhone: shippingAddress.phone,
        shippingAddressLine1: shippingAddress.addressLine1,
        shippingAddressLine2: shippingAddress.addressLine2,
        shippingCity: shippingAddress.city,
        shippingState: shippingAddress.state,
        shippingCountry: shippingAddress.country,
        shippingPostalCode: shippingAddress.postalCode,
        paymentMethod,
        paymentMethodId: resolvedPaymentMethodId,
        paymentReference,
        paymentStatus: paymentMethod === CheckoutPaymentMethod.COD ? 'unpaid' : 'unpaid',
      },
    });

    if (body.saveCard && gatewayToken && !paymentMethodId) {
      const saved = await this.paymentMethods.createFromGateway({
        userId: customerId,
        gatewayToken,
        brand: body.cardBrand!,
        last4: body.cardLast4!,
        expiry: body.cardExpiry!,
        cardholderName: `${shippingAddress.firstName} ${shippingAddress.lastName}`.trim(),
      });
      resolvedPaymentMethodId = saved.id;
      await this.prisma.order.update({
        where: { id: dbOrder.id },
        data: { paymentMethodId: saved.id },
      });
    }

    await this.notifications.notifyOrderCreated(customerId, dbOrder.id);

    const paymentMethods = await this.paymentMethods.listForCheckout(customerId);

    return {
      ...this.toOrderResponse({
        ...dbOrder,
        paymentMethodId: resolvedPaymentMethodId,
      }),
      paymentMethods,
    };
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

    await this.emitOrderTransitionNotifications(dbOrder, updated);

    return this.toOrderResponse(updated);
  }

  private formatOrderNumber(id: number) {
    return `ORD-${String(id).padStart(3, '0')}`;
  }

  private static readonly NOTIFY_PAYMENT_STATUSES = new Set(['paid', 'refunded']);

  private async emitOrderTransitionNotifications(
    before: { id: number; customerId: number; status: string; paymentStatus: string },
    after: { id: number; customerId: number; status: string; paymentStatus: string },
  ) {
    if (after.status !== before.status) {
      await this.notifications.notifyOrderStatusChange(
        after.customerId,
        after.id,
        after.status,
      );
    }

    if (
      after.paymentStatus !== before.paymentStatus &&
      OrdersService.NOTIFY_PAYMENT_STATUSES.has(after.paymentStatus)
    ) {
      await this.notifications.notifyOrderStatusChange(
        after.customerId,
        after.id,
        after.paymentStatus,
      );
    }
  }

  private async loadCustomerMap(customerIds: number[]) {
    const unique = [...new Set(customerIds)];
    if (unique.length === 0) return new Map<number, { name: string; email: string }>();

    const users = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true, email: true },
    });

    return new Map(users.map((u) => [u.id, { name: u.name, email: u.email }]));
  }

  private toAdminListItem(
    dbOrder: {
      id: number;
      customerId: number;
      productName: string | null;
      productImage: string | null;
      providerId: number | null;
      providerName: string | null;
      status: string;
      price: number | null;
      currency: string;
      paymentStatus: string;
      paymentMethod: string;
      isCustomOrder: boolean;
      createdAt: Date;
    },
    customer?: { name: string; email: string },
  ) {
    return {
      id: dbOrder.id,
      orderNumber: this.formatOrderNumber(dbOrder.id),
      status: dbOrder.status,
      productName: dbOrder.productName,
      productImage: dbOrder.productImage,
      providerId: dbOrder.providerId,
      providerName: dbOrder.providerName,
      customerId: dbOrder.customerId,
      customerName: customer?.name ?? null,
      customerEmail: customer?.email ?? null,
      price: dbOrder.price,
      currency: dbOrder.currency,
      paymentStatus: dbOrder.paymentStatus,
      paymentMethod: dbOrder.paymentMethod,
      isCustomOrder: dbOrder.isCustomOrder,
      createdAt: dbOrder.createdAt.toISOString(),
    };
  }

  async adminList(query: Record<string, unknown>) {
    const page = Math.max(1, Number(query?.page ?? 1));
    const pageSize = Math.max(1, Math.min(100, Number(query?.pageSize ?? 20)));
    const skip = (page - 1) * pageSize;

    const status = typeof query?.status === 'string' ? query.status.trim() : undefined;
    const paymentStatus =
      typeof query?.paymentStatus === 'string' ? query.paymentStatus.trim() : undefined;
    const q = typeof query?.q === 'string' ? query.q.trim() : '';

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;

    if (q.length > 0) {
      const asId = Number(q.replace(/^ORD-/i, ''));
      const or: Record<string, unknown>[] = [
        { productName: { contains: q, mode: 'insensitive' } },
        { providerName: { contains: q, mode: 'insensitive' } },
      ];
      if (!Number.isNaN(asId)) or.push({ id: asId });

      const matchingCustomers = await this.prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
        take: 50,
      });
      if (matchingCustomers.length > 0) {
        or.push({ customerId: { in: matchingCustomers.map((c) => c.id) } });
      }

      where.OR = or;
    }

    const [totalItems, items] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const customerMap = await this.loadCustomerMap(items.map((o) => o.customerId));

    return {
      data: items.map((item) =>
        this.toAdminListItem(item, customerMap.get(item.customerId)),
      ),
      pagination: {
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
        totalItems,
      },
    };
  }

  async adminGetById(orderId: number) {
    const dbOrder = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!dbOrder) {
      throw new NotFoundException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });
    }

    const customer = await this.prisma.user.findUnique({
      where: { id: dbOrder.customerId },
      select: { id: true, name: true, email: true, phone: true },
    });

    return {
      orderNumber: this.formatOrderNumber(dbOrder.id),
      ...this.toOrderResponse(dbOrder),
      customer: customer
        ? {
            id: customer.id,
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
          }
        : null,
    };
  }

  private static readonly ADMIN_ORDER_STATUSES = [
    'pending',
    'confirmed',
    'in_progress',
    'approved',
    'shipped',
    'delivered',
    'cancelled',
    'rejected',
  ] as const;

  private static readonly ADMIN_PAYMENT_STATUSES = ['unpaid', 'paid', 'refunded', 'failed'] as const;

  async adminPatch(orderId: number, body: Record<string, unknown>) {
    const dbOrder = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!dbOrder) {
      throw new NotFoundException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });
    }

    if (typeof body?.status === 'string') {
      const status = body.status.trim();
      if (!OrdersService.ADMIN_ORDER_STATUSES.includes(status as (typeof OrdersService.ADMIN_ORDER_STATUSES)[number])) {
        throw new BadRequestException({
          message: `Invalid status. Allowed: ${OrdersService.ADMIN_ORDER_STATUSES.join(', ')}`,
          code: 'VALIDATION_ERROR',
        });
      }
    }

    if (typeof body?.paymentStatus === 'string') {
      const paymentStatus = body.paymentStatus.trim();
      if (
        !OrdersService.ADMIN_PAYMENT_STATUSES.includes(
          paymentStatus as (typeof OrdersService.ADMIN_PAYMENT_STATUSES)[number],
        )
      ) {
        throw new BadRequestException({
          message: `Invalid paymentStatus. Allowed: ${OrdersService.ADMIN_PAYMENT_STATUSES.join(', ')}`,
          code: 'VALIDATION_ERROR',
        });
      }
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        ...(typeof body?.status === 'string' ? { status: body.status.trim() } : {}),
        ...(typeof body?.paymentReference === 'string'
          ? { paymentReference: body.paymentReference }
          : {}),
        ...(typeof body?.paymentStatus === 'string'
          ? { paymentStatus: body.paymentStatus.trim() }
          : {}),
        ...(typeof body?.paymentMethod === 'string' ? { paymentMethod: body.paymentMethod } : {}),
      },
    });

    await this.emitOrderTransitionNotifications(dbOrder, updated);

    const customer = await this.prisma.user.findUnique({
      where: { id: updated.customerId },
      select: { id: true, name: true, email: true, phone: true },
    });

    return {
      orderNumber: this.formatOrderNumber(updated.id),
      ...this.toOrderResponse(updated),
      customer: customer
        ? {
            id: customer.id,
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
          }
        : null,
    };
  }
}
