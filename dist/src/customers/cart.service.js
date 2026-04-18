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
exports.CartService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../database/prisma.service");
const crypto_1 = require("crypto");
const cartStore = new Map();
function splitProviderName(providerProfile, user) {
    return providerProfile?.brandName ?? user?.name ?? '';
}
let CartService = class CartService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    getCartForUser(userId) {
        const existing = cartStore.get(userId);
        if (existing)
            return existing;
        const created = [];
        cartStore.set(userId, created);
        return created;
    }
    async list(user) {
        const items = this.getCartForUser(user.sub);
        return items;
    }
    async add(user, body) {
        const userId = user.sub;
        const productId = Number(body?.productId ?? body?.id ?? 0);
        const quantity = Math.max(1, Number(body?.quantity ?? 1));
        if (!productId)
            return { message: 'Missing productId', code: 'VALIDATION_ERROR' };
        const p = await this.prisma.product.findUnique({ where: { id: productId } });
        if (!p)
            return { message: 'Product not found', code: 'RESOURCE_NOT_FOUND' };
        const provider = p.providerId
            ? await this.prisma.user.findUnique({
                where: { id: p.providerId },
                include: { artisanProfile: true },
            })
            : null;
        const basePrice = typeof body?.basePrice === 'number' ? body.basePrice : p.price;
        const finalPrice = typeof body?.finalPrice === 'number' ? body.finalPrice : basePrice;
        const item = {
            id: (0, crypto_1.randomUUID)(),
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
    async patch(user, cartItemId, body) {
        const userId = user.sub;
        const cart = this.getCartForUser(userId);
        const idx = cart.findIndex((i) => i.id === cartItemId);
        if (idx < 0)
            return { message: 'Not found', code: 'RESOURCE_NOT_FOUND' };
        const item = cart[idx];
        const quantity = body?.quantity !== undefined ? Math.max(1, Number(body.quantity)) : item.quantity;
        cart[idx] = {
            ...item,
            quantity,
            notes: body?.notes !== undefined ? (typeof body.notes === 'string' ? body.notes : null) : item.notes,
            selectedSize: body?.selectedSize !== undefined ? String(body.selectedSize) : item.selectedSize,
            selectedBodyType: body?.selectedBodyType !== undefined ? body.selectedBodyType : item.selectedBodyType,
        };
        return cart[idx];
    }
    async remove(user, cartItemId) {
        const userId = user.sub;
        const cart = this.getCartForUser(userId);
        const idx = cart.findIndex((i) => i.id === cartItemId);
        if (idx < 0)
            return { message: 'Not found', code: 'RESOURCE_NOT_FOUND' };
        cart.splice(idx, 1);
        return { success: true };
    }
    async clear(user) {
        const cart = this.getCartForUser(user.sub);
        cart.splice(0, cart.length);
        return { success: true };
    }
};
exports.CartService = CartService;
exports.CartService = CartService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CartService);
//# sourceMappingURL=cart.service.js.map