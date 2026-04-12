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
const orderStore = new Map();
let orderIdSeq = 1;
let OrdersService = class OrdersService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    getOrdersForUser(userId) {
        const existing = orderStore.get(userId);
        if (existing)
            return existing;
        const created = [];
        orderStore.set(userId, created);
        return created;
    }
    async list(user, query) {
        const page = Math.max(1, Number(query?.page ?? 1));
        const pageSize = Math.max(1, Math.min(100, Number(query?.pageSize ?? 20)));
        const status = typeof query?.status === 'string' ? query.status : undefined;
        const isCustomOrder = query?.isCustomOrder === 'true' ? true : query?.isCustomOrder === 'false' ? false : undefined;
        let items = this.getOrdersForUser(user.sub);
        if (status)
            items = items.filter((o) => o.status === status);
        if (isCustomOrder !== undefined)
            items = items.filter((o) => o.isCustomOrder === isCustomOrder);
        const totalItems = items.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
        const skip = (page - 1) * pageSize;
        const pageItems = items.slice(skip, skip + pageSize);
        return {
            data: pageItems,
            pagination: { page, pageSize, totalPages, totalItems },
        };
    }
    async getById(user, orderId) {
        const items = this.getOrdersForUser(user.sub);
        const found = items.find((o) => o.id === orderId);
        return found ?? null;
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
        const provider = await this.prisma.user.findUnique({
            where: { id: product.providerId },
            include: { artisanProfile: true },
        });
        const providerName = provider?.artisanProfile?.brandName ?? provider?.name ?? '';
        const shippingAddress = body?.shippingAddress ?? {};
        const order = {
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
    async patch(user, orderId, body) {
        const items = this.getOrdersForUser(user.sub);
        const idx = items.findIndex((o) => o.id === orderId);
        if (idx < 0)
            return null;
        const existing = items[idx];
        const next = {
            ...existing,
            ...(typeof body?.status === 'string' ? { status: body.status } : {}),
            ...(typeof body?.paymentReference === 'string' ? { paymentReference: body.paymentReference } : {}),
            ...(typeof body?.paymentStatus === 'string'
                ? { paymentStatus: body.paymentStatus }
                : {}),
            ...(typeof body?.paymentMethod === 'string' ? { paymentMethod: body.paymentMethod } : {}),
            updatedAt: new Date().toISOString(),
        };
        items[idx] = next;
        return next;
    }
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OrdersService);
//# sourceMappingURL=orders.service.js.map