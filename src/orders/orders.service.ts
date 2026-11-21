import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentMethodsService } from '../payments/payment-methods.service';
import { CheckoutPaymentMethod, CreateOrderDto } from './dto/create-order.dto';
import { priceOrderLine } from './order-pricing';
import { validateCustomisationPayload } from '../products/product-customisation.templates';
import {
  ARTISAN_ORDER_VIEWS,
  artisanNewOrdersWhere,
  isArtisanOrderView,
  summarizeArtisanOrders,
  summarizeArtisanOrdersWithReadiness,
} from './artisan-order-views';
import { NEW_ORDERS_READINESS_STATUSES } from './readiness.constants';
import { OrderReadinessService } from './order-readiness.service';
import { ArtisanPayoutService } from './artisan-payout.service';

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
  isTestOrder: boolean;
  testReference: string | null;
  simulatedPaymentStatus: string | null;
  estimatedDelivery: string | null;
  artisanName: string | null;
  readiness?: ReturnType<OrderReadinessService['readinessSummary']>;
  production?: ReturnType<ArtisanPayoutService['payoutSummaryForOrder']>;
  customerRating?: number | null;
  customerReview?: string | null;
  createdAt: string;
  updatedAt: string;
};

const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'cancelled'],
  in_progress: ['ready', 'cancelled'],
  ready: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
  // legacy aliases still accepted as current status
  approved: ['shipped', 'cancelled'],
  rejected: ['cancelled'],
};

const VALID_ORDER_STATUSES = new Set([
  'pending',
  'confirmed',
  'in_progress',
  'ready',
  'shipped',
  'delivered',
  'cancelled',
  'approved',
  'rejected',
]);

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly paymentMethods: PaymentMethodsService,
    private readonly readiness: OrderReadinessService,
    private readonly artisanPayouts: ArtisanPayoutService,
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
    isTestOrder?: boolean;
    testReference?: string | null;
    simulatedPaymentStatus?: string | null;
    estimatedDelivery: string | null;
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
    readinessAssignedAt?: Date | null;
    readinessResponseDeadline?: Date | null;
    readinessDeadlineExtendedAt?: Date | null;
    readinessExtensionHours?: number | null;
    readinessExtensionReason?: string | null;
    readinessWorkflowStatus?: string | null;
    highValueOverride?: boolean | null;
    productionStartedAt?: Date | null;
    productionDeadline?: Date | null;
    productionOriginalDeadline?: Date | null;
    productionDurationDays?: number | null;
    qualityReviewStatus?: string | null;
    fulfillmentStatus?: string | null;
    customerRating?: number | null;
    customerReview?: string | null;
    artisanPayout?: {
      status: string;
      fundingRequired: boolean;
      requestedAmount: number | null;
      approvedAmount: number | null;
      currency: string;
      disputeFlag: boolean;
      transfers?: Array<{ amount: number; currency: string; status: string }>;
    } | null;
  }): Order {
    const readinessFields = {
      readinessAssignedAt: dbOrder.readinessAssignedAt ?? null,
      readinessResponseDeadline: dbOrder.readinessResponseDeadline ?? null,
      readinessDeadlineExtendedAt: dbOrder.readinessDeadlineExtendedAt ?? null,
      readinessExtensionHours: dbOrder.readinessExtensionHours ?? null,
      readinessExtensionReason: dbOrder.readinessExtensionReason ?? null,
      readinessWorkflowStatus: dbOrder.readinessWorkflowStatus ?? null,
      highValueOverride: dbOrder.highValueOverride ?? null,
      isCustomOrder: dbOrder.isCustomOrder,
      price: dbOrder.price,
      currency: dbOrder.currency,
    };
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
      customisationData:
        (dbOrder.customisationData as Record<string, unknown>) ?? null,
      currency: dbOrder.currency,
      shippingAddress: this.resolveShippingForResponse(dbOrder),
      paymentMethod: dbOrder.paymentMethod,
      paymentMethodId: dbOrder.paymentMethodId,
      paymentReference: dbOrder.paymentReference,
      paymentStatus: dbOrder.paymentStatus,
      isTestOrder: dbOrder.isTestOrder ?? false,
      testReference: dbOrder.testReference ?? null,
      simulatedPaymentStatus: dbOrder.simulatedPaymentStatus ?? null,
      estimatedDelivery: dbOrder.estimatedDelivery,
      artisanName: dbOrder.providerName,
      readiness: this.readiness.readinessSummary(readinessFields),
      production: this.artisanPayouts.payoutSummaryForOrder({
        readinessWorkflowStatus: dbOrder.readinessWorkflowStatus ?? null,
        productionStartedAt: dbOrder.productionStartedAt ?? null,
        productionDeadline: dbOrder.productionDeadline ?? null,
        productionOriginalDeadline: dbOrder.productionOriginalDeadline ?? null,
        productionDurationDays: dbOrder.productionDurationDays ?? null,
        qualityReviewStatus: dbOrder.qualityReviewStatus ?? null,
        fulfillmentStatus: dbOrder.fulfillmentStatus ?? null,
        customerRating: dbOrder.customerRating ?? null,
        customerReview: dbOrder.customerReview ?? null,
        artisanPayout: dbOrder.artisanPayout ?? null,
      }),
      customerRating: dbOrder.customerRating ?? null,
      customerReview: dbOrder.customerReview ?? null,
      createdAt: dbOrder.createdAt.toISOString(),
      updatedAt: dbOrder.updatedAt.toISOString(),
    };
  }

  private assertStatusTransition(from: string, to: string) {
    const allowed = ORDER_STATUS_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException({
        message: `Invalid status transition from "${from}" to "${to}"`,
        code: 'VALIDATION_ERROR',
      });
    }
  }

  private async appendStatusHistory(
    orderId: number,
    status: string,
    changedBy: number | null,
    note?: string | null,
  ) {
    await this.prisma.orderStatusHistory.create({
      data: {
        orderId,
        status,
        changedBy,
        note: note?.trim() || null,
      },
    });
  }

  private canAccessOrder(
    user: AccessTokenPayload,
    order: { customerId: number; providerId: number | null },
  ) {
    if (user.role === 'admin') return true;
    if (order.customerId === user.sub) return true;
    if (user.role === 'artisan' && order.providerId === user.sub) return true;
    return false;
  }

  async list(user: AccessTokenPayload, query: Record<string, unknown>) {
    const page = Math.max(1, Number(query?.page ?? 1));
    const pageSize = Math.max(1, Math.min(100, Number(query?.pageSize ?? 20)));
    const isCustomOrder =
      query?.isCustomOrder === 'true'
        ? true
        : query?.isCustomOrder === 'false'
          ? false
          : undefined;

    const view = typeof query.view === 'string' ? query.view.trim() : '';
    let where: Record<string, unknown> =
      user.role === 'artisan'
        ? { providerId: user.sub }
        : { customerId: user.sub };

    if (user.role === 'artisan' && view === 'new') {
      where = artisanNewOrdersWhere(user.sub);
    } else {
      const statuses = this.resolveListStatuses(query);
      if (statuses?.length === 1) where.status = statuses[0];
      else if (statuses && statuses.length > 1) where.status = { in: statuses };
    }
    if (isCustomOrder !== undefined) where.isCustomOrder = isCustomOrder;

    const totalItems = await this.prisma.order.count({ where });
    const skip = (page - 1) * pageSize;

    const items = await this.prisma.order.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        artisanPayout: {
          include: {
            transfers: {
              select: { amount: true, currency: true, status: true },
            },
          },
        },
      },
    });

    let summary: ReturnType<typeof summarizeArtisanOrders> | undefined;
    if (user.role === 'artisan') {
      const statusRows = (
        await this.prisma.order.groupBy({
          by: ['status'],
          where: { providerId: user.sub },
          _count: { _all: true },
        })
      ).map((row) => ({ status: row.status, count: row._count._all }));
      const [newReadinessCount, legacyPendingWithoutReadiness] =
        await Promise.all([
          this.prisma.order.count({
            where: {
              providerId: user.sub,
              readinessWorkflowStatus: {
                in: [...NEW_ORDERS_READINESS_STATUSES],
              },
              productionStartedAt: null,
              status: {
                notIn: [
                  'cancelled',
                  'rejected',
                  'in_progress',
                  'ready',
                  'shipped',
                  'delivered',
                ],
              },
            },
          }),
          this.prisma.order.count({
            where: {
              providerId: user.sub,
              readinessWorkflowStatus: null,
              status: 'pending',
            },
          }),
        ]);
      summary = summarizeArtisanOrdersWithReadiness(
        statusRows,
        newReadinessCount,
        legacyPendingWithoutReadiness,
      );
    }

    return {
      data: items.map((item) => this.toOrderResponse(item)),
      total: totalItems,
      ...(summary ? { summary } : {}),
    };
  }

  private resolveListStatuses(
    query: Record<string, unknown>,
  ): string[] | undefined {
    const view = typeof query.view === 'string' ? query.view.trim() : '';
    if (view && view !== 'all') {
      if (!isArtisanOrderView(view)) {
        throw new BadRequestException({
          message: 'Invalid order view. Allowed: new, pending, completed, all',
          code: 'VALIDATION_ERROR',
        });
      }
      if (view === 'new') {
        // Handled specially in list() via artisanNewOrdersWhere.
        return [...ARTISAN_ORDER_VIEWS.new];
      }
      return [...ARTISAN_ORDER_VIEWS[view]];
    }

    const raw = typeof query.status === 'string' ? query.status.trim() : '';
    if (!raw) return undefined;
    const parts = raw
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    const invalid = parts.filter((part) => !VALID_ORDER_STATUSES.has(part));
    if (invalid.length > 0) {
      throw new BadRequestException({
        message: `Invalid status. Allowed: ${[...VALID_ORDER_STATUSES].join(', ')}`,
        code: 'VALIDATION_ERROR',
      });
    }
    return parts;
  }

  async getById(user: AccessTokenPayload, orderId: string) {
    const dbOrder = await this.prisma.order.findUnique({
      where: { id: Number(orderId) },
      include: {
        artisanPayout: {
          include: {
            transfers: {
              select: { amount: true, currency: true, status: true },
            },
          },
        },
      },
    });
    if (!dbOrder || !this.canAccessOrder(user, dbOrder)) return null;

    let estimatedDelivery = dbOrder.estimatedDelivery;
    if (!estimatedDelivery) {
      const product = await this.prisma.product.findUnique({
        where: { id: dbOrder.productId },
        select: { estimatedDelivery: true, estimatedDeliveryDays: true },
      });
      estimatedDelivery =
        product?.estimatedDelivery ??
        (product?.estimatedDeliveryDays
          ? `${product.estimatedDeliveryDays} days`
          : null);
    }

    return {
      ...this.toOrderResponse({ ...dbOrder, estimatedDelivery }),
    };
  }

  async getTracking(user: AccessTokenPayload, orderId: string) {
    const dbOrder = await this.prisma.order.findUnique({
      where: { id: Number(orderId) },
    });
    if (!dbOrder || !this.canAccessOrder(user, dbOrder)) {
      throw new NotFoundException({
        message: 'Not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    const history = await this.prisma.orderStatusHistory.findMany({
      where: { orderId: dbOrder.id },
      orderBy: { createdAt: 'asc' },
    });

    if (history.length === 0) {
      return {
        orderId: dbOrder.id,
        currentStatus: dbOrder.status,
        history: [
          {
            status: dbOrder.status,
            changedBy: null,
            note: null,
            createdAt: dbOrder.createdAt.toISOString(),
          },
        ],
      };
    }

    return {
      orderId: dbOrder.id,
      currentStatus: dbOrder.status,
      history: history.map((h) => ({
        status: h.status,
        changedBy: h.changedBy,
        note: h.note,
        createdAt: h.createdAt.toISOString(),
      })),
    };
  }

  async patchStatus(
    user: AccessTokenPayload,
    orderId: string,
    body: { status?: string; note?: string },
  ) {
    if (user.role !== 'admin' && user.role !== 'artisan') {
      throw new ForbiddenException({
        message: 'Forbidden',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    const id = Number(orderId);
    const dbOrder = await this.prisma.order.findUnique({ where: { id } });
    if (!dbOrder) {
      throw new NotFoundException({
        message: 'Not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    if (user.role === 'artisan' && dbOrder.providerId !== user.sub) {
      throw new ForbiddenException({
        message: 'Forbidden',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    const nextStatus = body.status?.trim();
    if (!nextStatus || !VALID_ORDER_STATUSES.has(nextStatus)) {
      throw new BadRequestException({
        message: 'Invalid status',
        code: 'VALIDATION_ERROR',
      });
    }

    this.assertStatusTransition(dbOrder.status, nextStatus);

    // Phase 2: readiness orders must use Start Work; closes artisan bypass.
    if (nextStatus === 'in_progress') {
      await this.readiness.assertProductionStartAllowed(dbOrder);
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: nextStatus },
      include: {
        artisanPayout: {
          include: {
            transfers: {
              select: { amount: true, currency: true, status: true },
            },
          },
        },
      },
    });

    await this.appendStatusHistory(id, nextStatus, user.sub, body.note);
    await this.emitOrderTransitionNotifications(dbOrder, updated);

    return this.toOrderResponse(updated);
  }

  async create(
    user: AccessTokenPayload,
    body: CreateOrderDto,
    simulation?: { isTestOrder: true; testReference: string },
  ) {
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
          message:
            'paymentMethodId or gatewayToken is required for card payments',
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
          message:
            'cardBrand, cardLast4, and cardExpiry are required when saveCard is true',
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

    const rawCustomisation =
      (first.customisation as Record<string, unknown> | undefined) ??
      (first.customization as Record<string, unknown> | undefined) ??
      null;
    // FE sometimes puts variation selections in `customisation`; keep template
    // customisation separate from product variation selections.
    const variationKeys = new Set([
      'size',
      'colour',
      'color',
      'material',
      'body_type',
      'shoe_size',
      'length',
      'width',
    ]);
    const customisationLooksLikeVariations =
      !!rawCustomisation &&
      Object.keys(rawCustomisation).length > 0 &&
      Object.keys(rawCustomisation).every((k) => variationKeys.has(k));

    const selectedVariations = {
      ...((first.selectedVariants as Record<string, unknown> | undefined) ??
        {}),
      ...((first.selectedVariations as Record<string, unknown> | undefined) ??
        {}),
      ...(customisationLooksLikeVariations ? rawCustomisation : {}),
    };
    const selectedBodyType =
      (first.selectedBodyType as string | undefined) ??
      (selectedVariations.body_type as string | undefined) ??
      null;
    const baseCustomisation = customisationLooksLikeVariations
      ? null
      : rawCustomisation;
    const customisationData =
      baseCustomisation ||
      Object.keys(selectedVariations).length > 0 ||
      selectedBodyType ||
      first.selectedSize
        ? {
            ...(baseCustomisation ?? {}),
            ...(Object.keys(selectedVariations).length
              ? { selectedVariations }
              : {}),
            ...(selectedBodyType ? { selectedBodyType } : {}),
            ...(first.selectedSize ? { selectedSize: first.selectedSize } : {}),
          }
        : null;

    if (baseCustomisation && product.category) {
      const validation = validateCustomisationPayload(
        product.category,
        baseCustomisation,
      );
      if (!validation.valid) {
        const parts: string[] = [];
        if (validation.unknownKeys.length) {
          parts.push(`unknown keys: ${validation.unknownKeys.join(', ')}`);
        }
        if (validation.missingRequired.length) {
          parts.push(
            `missing required: ${validation.missingRequired.join(', ')}`,
          );
        }
        throw new BadRequestException({
          message: `Invalid customisation (${parts.join('; ')})`,
          code: 'INVALID_CUSTOMISATION',
        });
      }
    }

    const priced = await this.priceLine(
      product,
      first,
      selectedVariations,
      rushOrder,
      artisanProfile?.rushOrderSurchargePercent ?? 25,
    );

    const dbOrder = await this.prisma.order.create({
      data: {
        customerId,
        productId: product.id,
        productName: product.name,
        productImage: product.imageUrl ?? product.images?.[0] ?? null,
        providerId: product.providerId,
        providerName: artisanProfile?.brandName ?? provider?.name ?? '',
        customizationId: null,
        isCustomOrder: Boolean(baseCustomisation),
        status: 'pending',
        basePrice: priced.basePrice,
        rushSurcharge: rushOrder ? priced.rushSurcharge : null,
        rushOrder,
        price: priced.finalPrice,
        customisationData: customisationData
          ? (customisationData as object)
          : undefined,
        currency: (product.currency || 'NGN').toUpperCase(),
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
        paymentMethod: simulation ? 'simulated' : paymentMethod,
        paymentMethodId: resolvedPaymentMethodId,
        paymentReference,
        paymentStatus:
          paymentMethod === CheckoutPaymentMethod.COD ? 'unpaid' : 'unpaid',
        isTestOrder: simulation?.isTestOrder ?? false,
        testReference: simulation?.testReference ?? null,
        simulatedPaymentStatus: simulation ? 'pending' : null,
        estimatedDelivery:
          product.estimatedDelivery ??
          (product.estimatedDeliveryDays
            ? `${product.estimatedDeliveryDays} days`
            : null),
      },
    });

    await this.appendStatusHistory(dbOrder.id, 'pending', customerId, null);

    // Phase 1: assign readiness workflow for newly created orders with a provider.
    // Historical orders are not backfilled into this mandatory flow.
    if (dbOrder.providerId) {
      await this.readiness.assignReadinessOnCreate({
        id: dbOrder.id,
        providerId: dbOrder.providerId,
        productName: dbOrder.productName,
      });
    }

    if (body.saveCard && gatewayToken && !paymentMethodId) {
      const saved = await this.paymentMethods.createFromGateway({
        userId: customerId,
        gatewayToken,
        brand: body.cardBrand!,
        last4: body.cardLast4!,
        expiry: body.cardExpiry!,
        cardholderName:
          `${shippingAddress.firstName} ${shippingAddress.lastName}`.trim(),
      });
      resolvedPaymentMethodId = saved.id;
      await this.prisma.order.update({
        where: { id: dbOrder.id },
        data: { paymentMethodId: saved.id },
      });
    }

    await this.notifications.notifyOrderCreated(customerId, dbOrder.id);

    const paymentMethods =
      await this.paymentMethods.listForCheckout(customerId);
    const fresh = await this.prisma.order.findUnique({
      where: { id: dbOrder.id },
    });

    return {
      ...this.toOrderResponse({
        ...(fresh ?? dbOrder),
        paymentMethodId: resolvedPaymentMethodId,
      }),
      paymentMethods,
    };
  }

  async patch(
    user: AccessTokenPayload,
    orderId: string,
    body: Record<string, unknown>,
  ) {
    const dbOrder = await this.prisma.order.findUnique({
      where: { id: Number(orderId) },
    });
    if (!dbOrder || dbOrder.customerId !== user.sub) return null;

    // Payment status is applied only after gateway verification.
    const data: { status?: string } = {};
    if (typeof body?.status === 'string') data.status = body.status;
    if (!data.status) return this.toOrderResponse(dbOrder);

    const updated = await this.prisma.order.update({
      where: { id: Number(orderId) },
      data,
    });

    await this.emitOrderTransitionNotifications(dbOrder, updated);

    return this.toOrderResponse(updated);
  }

  async applyVerifiedPayment(input: {
    orderId: number;
    customerId: number;
    gateway: 'paystack' | 'flutterwave';
    reference: string;
    outcome: 'paid' | 'failed';
  }): Promise<{
    paymentStatus: string;
    orderStatus: string;
    alreadyPaid: boolean;
  }> {
    const dbOrder = await this.prisma.order.findUnique({
      where: { id: input.orderId },
    });
    if (!dbOrder || dbOrder.customerId !== input.customerId) {
      throw new NotFoundException({
        message: 'Order not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    if (dbOrder.paymentStatus === 'paid') {
      return {
        paymentStatus: 'paid',
        orderStatus: dbOrder.status,
        alreadyPaid: true,
      };
    }
    if (input.outcome === 'failed') {
      await this.prisma.order.updateMany({
        where: { id: dbOrder.id, paymentStatus: { not: 'paid' } },
        data: { paymentStatus: 'failed' },
      });
      return {
        paymentStatus: 'failed',
        orderStatus: dbOrder.status,
        alreadyPaid: false,
      };
    }
    if (dbOrder.status === 'cancelled' || dbOrder.status === 'rejected') {
      throw new BadRequestException({
        message: 'This order can no longer be paid',
        code: 'ORDER_NOT_PAYABLE',
      });
    }

    const nextStatus =
      dbOrder.status === 'pending' ? 'confirmed' : dbOrder.status;
    const updated = await this.prisma.order.updateMany({
      where: {
        id: dbOrder.id,
        customerId: input.customerId,
        paymentStatus: { not: 'paid' },
        status: { notIn: ['cancelled', 'rejected'] },
      },
      data: {
        paymentStatus: 'paid',
        paymentReference: input.reference,
        paymentMethod: input.gateway,
        status: nextStatus,
      },
    });
    if (updated.count === 0) {
      const fresh = await this.prisma.order.findUnique({
        where: { id: dbOrder.id },
      });
      if (fresh?.paymentStatus === 'paid') {
        return {
          paymentStatus: 'paid',
          orderStatus: fresh.status,
          alreadyPaid: true,
        };
      }
      throw new BadRequestException({
        message: 'This order can no longer be paid',
        code: 'ORDER_NOT_PAYABLE',
      });
    }

    if (nextStatus !== dbOrder.status) {
      await this.appendStatusHistory(
        dbOrder.id,
        nextStatus,
        null,
        'Payment confirmed',
      );
    }
    await this.emitOrderTransitionNotifications(dbOrder, {
      ...dbOrder,
      status: nextStatus,
      paymentStatus: 'paid',
    });
    return {
      paymentStatus: 'paid',
      orderStatus: nextStatus,
      alreadyPaid: false,
    };
  }

  private async priceLine(
    product: { id: number; price: number | null },
    item: CreateOrderDto['items'][number],
    selection: Record<string, unknown>,
    rushOrder: boolean,
    surchargePercent: number,
  ) {
    const variationTypes = await this.prisma.productVariationType.findMany({
      where: { productId: product.id, isEnabled: true },
      include: {
        options: { select: { value: true, label: true, priceOverride: true } },
      },
    });
    const priced = priceOrderLine({
      catalogPrice: product.price,
      quantity: item.quantity,
      rushOrder,
      surchargePercent,
      variationTypes,
      selection,
    });
    if (!priced) {
      throw new BadRequestException({
        message: 'This product does not have a price set',
        code: 'VALIDATION_ERROR',
      });
    }
    return priced;
  }

  private formatOrderNumber(id: number) {
    return `ORD-${String(id).padStart(3, '0')}`;
  }

  private static readonly NOTIFY_PAYMENT_STATUSES = new Set([
    'paid',
    'refunded',
  ]);

  private async emitOrderTransitionNotifications(
    before: {
      id: number;
      customerId: number;
      status: string;
      paymentStatus: string;
    },
    after: {
      id: number;
      customerId: number;
      status: string;
      paymentStatus: string;
    },
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
    if (unique.length === 0)
      return new Map<number, { name: string; email: string }>();

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
      isTestOrder?: boolean;
      testReference?: string | null;
      simulatedPaymentStatus?: string | null;
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
      isTestOrder: dbOrder.isTestOrder ?? false,
      testReference: dbOrder.testReference ?? null,
      simulatedPaymentStatus: dbOrder.simulatedPaymentStatus ?? null,
      createdAt: dbOrder.createdAt.toISOString(),
    };
  }

  async adminList(query: Record<string, unknown>) {
    const page = Math.max(1, Number(query?.page ?? 1));
    const pageSize = Math.max(1, Math.min(100, Number(query?.pageSize ?? 20)));
    const skip = (page - 1) * pageSize;

    const status =
      typeof query?.status === 'string' ? query.status.trim() : undefined;
    const paymentStatus =
      typeof query?.paymentStatus === 'string'
        ? query.paymentStatus.trim()
        : undefined;
    const q = typeof query?.q === 'string' ? query.q.trim() : '';

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;

    if (q.length > 0) {
      const asId = Number(q.replace(/^ORD-/i, ''));
      const or: Record<string, unknown>[] = [
        { productName: { contains: q, mode: 'insensitive' } },
        { providerName: { contains: q, mode: 'insensitive' } },
        { testReference: { contains: q, mode: 'insensitive' } },
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

    const customerMap = await this.loadCustomerMap(
      items.map((o) => o.customerId),
    );

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
      throw new NotFoundException({
        message: 'Not found',
        code: 'RESOURCE_NOT_FOUND',
      });
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
    'ready',
    'shipped',
    'delivered',
    'cancelled',
    'approved',
    'rejected',
  ] as const;

  private static readonly ADMIN_PAYMENT_STATUSES = [
    'unpaid',
    'paid',
    'refunded',
    'failed',
  ] as const;

  async adminPatch(orderId: number, body: Record<string, unknown>) {
    const dbOrder = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!dbOrder) {
      throw new NotFoundException({
        message: 'Not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    let nextStatus: string | undefined;
    if (typeof body?.status === 'string') {
      const status = body.status.trim();
      if (
        !OrdersService.ADMIN_ORDER_STATUSES.includes(
          status as (typeof OrdersService.ADMIN_ORDER_STATUSES)[number],
        )
      ) {
        throw new BadRequestException({
          message: `Invalid status. Allowed: ${OrdersService.ADMIN_ORDER_STATUSES.join(', ')}`,
          code: 'VALIDATION_ERROR',
        });
      }
      nextStatus = status;
      this.assertStatusTransition(dbOrder.status, status);
      // Phase 2: close adminPatch bypass for production start.
      if (status === 'in_progress') {
        await this.readiness.assertProductionStartAllowed(dbOrder);
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
        ...(nextStatus ? { status: nextStatus } : {}),
        ...(typeof body?.paymentReference === 'string'
          ? { paymentReference: body.paymentReference }
          : {}),
        ...(typeof body?.paymentStatus === 'string'
          ? { paymentStatus: body.paymentStatus.trim() }
          : {}),
        ...(typeof body?.paymentMethod === 'string'
          ? { paymentMethod: body.paymentMethod }
          : {}),
      },
      include: {
        artisanPayout: {
          include: {
            transfers: {
              select: { amount: true, currency: true, status: true },
            },
          },
        },
      },
    });

    if (nextStatus) {
      await this.appendStatusHistory(
        orderId,
        nextStatus,
        null,
        typeof body?.note === 'string' ? body.note : null,
      );
    }

    await this.emitOrderTransitionNotifications(dbOrder, updated);

    const customer = await this.prisma.user.findUnique({
      where: { id: updated.customerId },
      select: { id: true, name: true, email: true, phone: true },
    });

    let estimatedDelivery = updated.estimatedDelivery;
    if (!estimatedDelivery) {
      const product = await this.prisma.product.findUnique({
        where: { id: updated.productId },
        select: { estimatedDelivery: true, estimatedDeliveryDays: true },
      });
      estimatedDelivery =
        product?.estimatedDelivery ??
        (product?.estimatedDeliveryDays
          ? `${product.estimatedDeliveryDays} days`
          : null);
    }

    return {
      orderNumber: this.formatOrderNumber(updated.id),
      ...this.toOrderResponse({ ...updated, estimatedDelivery }),
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
