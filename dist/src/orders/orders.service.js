"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var OrdersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../database/prisma.service");
const product_customisation_templates_1 = require("../products/product-customisation.templates");
let OrdersService = class OrdersService {
    static { OrdersService_1 = this; }
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    toOrderResponse(dbOrder) {
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
            customisationData: dbOrder.customisationData ?? null,
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
    async list(user, query) {
        const page = Math.max(1, Number(query?.page ?? 1));
        const pageSize = Math.max(1, Math.min(100, Number(query?.pageSize ?? 20)));
        const status = typeof query?.status === 'string' ? query.status : undefined;
        const isCustomOrder = query?.isCustomOrder === 'true' ? true : query?.isCustomOrder === 'false' ? false : undefined;
        const where = { customerId: user.sub };
        if (status)
            where.status = status;
        if (isCustomOrder !== undefined)
            where.isCustomOrder = isCustomOrder;
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
    async getById(user, orderId) {
        const dbOrder = await this.prisma.order.findUnique({
            where: { id: Number(orderId) },
        });
        if (!dbOrder || dbOrder.customerId !== user.sub)
            return null;
        return this.toOrderResponse(dbOrder);
    }
    async create(user, body) {
        const customerId = user.sub;
        const items = Array.isArray(body?.items) ? body.items : [];
        if (items.length === 0) {
            return { message: 'Missing items', code: 'VALIDATION_ERROR' };
        }
        const first = items[0];
        const productId = Number(first.productId);
        const product = await this.prisma.product.findUnique({ where: { id: productId } });
        if (!product)
            return { message: 'Product not found', code: 'RESOURCE_NOT_FOUND' };
        const provider = product.providerId
            ? await this.prisma.user.findUnique({
                where: { id: product.providerId },
                include: { artisanProfile: true },
            })
            : null;
        const artisanProfile = provider?.artisanProfile;
        const rushOrder = Boolean(first.rushOrder ?? body.rushOrder ?? false);
        if (rushOrder && !artisanProfile?.rushOrderEnabled) {
            throw new common_1.BadRequestException({
                message: 'Rush order is not available for this artisan',
                code: 'RUSH_ORDER_NOT_AVAILABLE',
            });
        }
        const basePrice = typeof first.basePrice === 'number'
            ? first.basePrice
            : typeof first.finalPrice === 'number'
                ? first.finalPrice
                : (product.price ?? 0);
        const surchargePercent = artisanProfile?.rushOrderSurchargePercent ?? 25;
        const rushSurcharge = rushOrder ? basePrice * (surchargePercent / 100) : 0;
        const finalPrice = basePrice + rushSurcharge;
        const customisationData = first.customisation ??
            first.customization ??
            null;
        if (customisationData && product.category) {
            const validation = (0, product_customisation_templates_1.validateCustomisationPayload)(product.category, customisationData);
            if (!validation.valid) {
                throw new common_1.BadRequestException({
                    message: `Unknown customisation keys: ${validation.unknownKeys.join(', ')}`,
                    code: 'INVALID_CUSTOMISATION',
                });
            }
        }
        const shippingAddress = (body.shippingAddress ?? {});
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
                    ? customisationData
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
    async patch(user, orderId, body) {
        const dbOrder = await this.prisma.order.findUnique({
            where: { id: Number(orderId) },
        });
        if (!dbOrder || dbOrder.customerId !== user.sub)
            return null;
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
    formatOrderNumber(id) {
        return `ORD-${String(id).padStart(3, '0')}`;
    }
    async loadCustomerMap(customerIds) {
        const unique = [...new Set(customerIds)];
        if (unique.length === 0)
            return new Map();
        const users = await this.prisma.user.findMany({
            where: { id: { in: unique } },
            select: { id: true, name: true, email: true },
        });
        return new Map(users.map((u) => [u.id, { name: u.name, email: u.email }]));
    }
    toAdminListItem(dbOrder, customer) {
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
    async adminList(query) {
        const page = Math.max(1, Number(query?.page ?? 1));
        const pageSize = Math.max(1, Math.min(100, Number(query?.pageSize ?? 20)));
        const skip = (page - 1) * pageSize;
        const status = typeof query?.status === 'string' ? query.status.trim() : undefined;
        const paymentStatus = typeof query?.paymentStatus === 'string' ? query.paymentStatus.trim() : undefined;
        const q = typeof query?.q === 'string' ? query.q.trim() : '';
        const where = {};
        if (status)
            where.status = status;
        if (paymentStatus)
            where.paymentStatus = paymentStatus;
        if (q.length > 0) {
            const asId = Number(q.replace(/^ORD-/i, ''));
            const or = [
                { productName: { contains: q, mode: 'insensitive' } },
                { providerName: { contains: q, mode: 'insensitive' } },
            ];
            if (!Number.isNaN(asId))
                or.push({ id: asId });
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
            data: items.map((item) => this.toAdminListItem(item, customerMap.get(item.customerId))),
            pagination: {
                page,
                pageSize,
                totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
                totalItems,
            },
        };
    }
    async adminGetById(orderId) {
        const dbOrder = await this.prisma.order.findUnique({
            where: { id: orderId },
        });
        if (!dbOrder) {
            throw new common_1.NotFoundException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });
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
    static ADMIN_ORDER_STATUSES = [
        'pending',
        'confirmed',
        'in_progress',
        'approved',
        'shipped',
        'delivered',
        'cancelled',
        'rejected',
    ];
    static ADMIN_PAYMENT_STATUSES = ['unpaid', 'paid', 'refunded', 'failed'];
    async adminPatch(orderId, body) {
        const dbOrder = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!dbOrder) {
            throw new common_1.NotFoundException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });
        }
        if (typeof body?.status === 'string') {
            const status = body.status.trim();
            if (!OrdersService_1.ADMIN_ORDER_STATUSES.includes(status)) {
                throw new common_1.BadRequestException({
                    message: `Invalid status. Allowed: ${OrdersService_1.ADMIN_ORDER_STATUSES.join(', ')}`,
                    code: 'VALIDATION_ERROR',
                });
            }
        }
        if (typeof body?.paymentStatus === 'string') {
            const paymentStatus = body.paymentStatus.trim();
            if (!OrdersService_1.ADMIN_PAYMENT_STATUSES.includes(paymentStatus)) {
                throw new common_1.BadRequestException({
                    message: `Invalid paymentStatus. Allowed: ${OrdersService_1.ADMIN_PAYMENT_STATUSES.join(', ')}`,
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
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = OrdersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OrdersService);
//# sourceMappingURL=orders.service.js.map