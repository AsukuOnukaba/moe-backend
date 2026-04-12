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
exports.WishlistService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../database/prisma.service");
const wishlistStore = new Map();
let wishlistIdSeq = 1;
function splitCsv(value) {
    if (!value)
        return [];
    return value.split(',').map((s) => s.trim()).filter(Boolean);
}
let WishlistService = class WishlistService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    list(userId) {
        const existing = wishlistStore.get(userId);
        if (existing)
            return existing;
        const created = [];
        wishlistStore.set(userId, created);
        return created;
    }
    async add(user, body) {
        const userId = user.sub;
        const productId = Number(body?.productId ?? body?.id ?? 0);
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
        const priceMin = typeof body?.priceMin === 'number' ? body.priceMin : p.price;
        const priceMax = typeof body?.priceMax === 'number' ? body.priceMax : p.price;
        const item = {
            id: wishlistIdSeq++,
            customerId: userId,
            productId: p.id,
            productName: p.name,
            providerId: p.providerId,
            providerName: provider?.artisanProfile?.brandName ?? provider?.name ?? '',
            priceMin,
            priceMax,
            currency: p.currency ?? 'NGN',
            category: p.category ?? null,
            imageUrl: p.imageUrl ?? null,
            styleTags: splitCsv(p.tags),
            addedAt: new Date().toISOString(),
        };
        const list = this.list(userId);
        const existingIdx = list.findIndex((x) => x.productId === productId);
        if (existingIdx >= 0)
            list.splice(existingIdx, 1, item);
        else
            list.push(item);
        return item;
    }
    async listAll(user) {
        return this.list(user.sub);
    }
    async remove(user, productId) {
        const userId = user.sub;
        const list = this.list(userId);
        const idx = list.findIndex((x) => x.productId === productId);
        if (idx < 0)
            return { message: 'Not found', code: 'RESOURCE_NOT_FOUND' };
        list.splice(idx, 1);
        return { success: true };
    }
};
exports.WishlistService = WishlistService;
exports.WishlistService = WishlistService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WishlistService);
//# sourceMappingURL=wishlist.service.js.map