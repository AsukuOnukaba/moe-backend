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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../database/prisma.service");
const product_customisation_templates_1 = require("../products/product-customisation.templates");
let OrdersService = class OrdersService {
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
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OrdersService);
//# sourceMappingURL=orders.service.js.map