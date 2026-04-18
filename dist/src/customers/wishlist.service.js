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
    async add(user, body) {
        const userId = user.sub;
        const productId = Number(body?.productId ?? body?.id ?? 0);
        if (!productId) {
            throw new common_1.BadRequestException({ message: 'Missing productId' });
        }
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
            include: { provider: { include: { artisanProfile: true } } },
        });
        if (!product) {
            throw new common_1.BadRequestException({ message: 'Product not found' });
        }
        const existing = await this.prisma.wishlistItem.findUnique({
            where: { userId_productId: { userId, productId } },
        });
        if (existing) {
            return this.formatWishlistItem(product, existing);
        }
        const wishlistItem = await this.prisma.wishlistItem.create({
            data: {
                userId,
                productId,
            },
        });
        return this.formatWishlistItem(product, wishlistItem);
    }
    async listAll(user) {
        const userId = user.sub;
        const items = await this.prisma.wishlistItem.findMany({
            where: { userId },
            include: {
                product: {
                    include: { provider: { include: { artisanProfile: true } } },
                },
            },
            orderBy: { addedAt: 'desc' },
        });
        const data = items.map((item) => this.formatWishlistItem(item.product, item));
        return {
            data,
            total: data.length,
        };
    }
    async remove(user, productId) {
        const userId = user.sub;
        const existing = await this.prisma.wishlistItem.findUnique({
            where: { userId_productId: { userId, productId } },
        });
        if (!existing) {
            throw new common_1.BadRequestException({ message: 'Not found' });
        }
        await this.prisma.wishlistItem.delete({
            where: { userId_productId: { userId, productId } },
        });
        return null;
    }
    formatWishlistItem(product, wishlistItem) {
        const provider = product.provider;
        const providerName = provider?.artisanProfile?.brandName || provider?.name || 'Unknown';
        return {
            id: wishlistItem.id,
            productId: product.id,
            productName: product.name,
            providerId: product.providerId,
            providerName: providerName,
            price: product.price ?? null,
            currency: product.currency ?? 'NGN',
            category: product.category ?? null,
            imageUrl: product.imageUrl ?? (product.images?.[0] ?? null),
            styleTags: splitCsv(product.tags),
            addedAt: wishlistItem.addedAt,
        };
    }
};
exports.WishlistService = WishlistService;
exports.WishlistService = WishlistService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WishlistService);
//# sourceMappingURL=wishlist.service.js.map