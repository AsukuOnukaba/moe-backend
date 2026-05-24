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
const product_mapper_1 = require("../common/product-mapper");
let WishlistService = class WishlistService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async addByProductId(user, productId) {
        if (!productId) {
            throw new common_1.BadRequestException({ message: 'Missing productId' });
        }
        return this.add(user, { productId });
    }
    async add(user, body) {
        const userId = user.sub;
        const productId = Number(body?.productId ?? body?.id ?? 0);
        if (!productId) {
            throw new common_1.BadRequestException({ message: 'Missing productId' });
        }
        const product = await this.prisma.product.findUnique({ where: { id: productId } });
        if (!product) {
            throw new common_1.BadRequestException({ message: 'Product not found' });
        }
        const existing = await this.prisma.wishlistItem.findUnique({
            where: { userId_productId: { userId, productId } },
        });
        if (existing) {
            const withProduct = await this.prisma.wishlistItem.findUnique({
                where: { userId_productId: { userId, productId } },
                include: this.itemInclude(),
            });
            return this.toWishlistItemDto(withProduct);
        }
        const created = await this.prisma.wishlistItem.create({
            data: { userId, productId },
            include: this.itemInclude(),
        });
        return this.toWishlistItemDto(created);
    }
    itemInclude() {
        return {
            product: {
                include: {
                    provider: { include: { artisanProfile: true } },
                },
            },
        };
    }
    resolveProviderName(product) {
        const provider = product.provider;
        if (!provider)
            return null;
        return provider.artisanProfile?.brandName ?? provider.name;
    }
    toWishlistItemDto(item) {
        const providerName = this.resolveProviderName(item.product);
        return {
            wishlistItemId: item.id,
            productId: item.productId,
            addedAt: item.addedAt.toISOString(),
            providerName,
            artisanName: providerName,
            ...(0, product_mapper_1.productToDto)(item.product),
        };
    }
    async listFullProducts(user) {
        const userId = user.sub;
        const items = await this.prisma.wishlistItem.findMany({
            where: { userId },
            include: this.itemInclude(),
            orderBy: { addedAt: 'desc' },
        });
        return {
            data: items.map((item) => this.toWishlistItemDto(item)),
            total: items.length,
        };
    }
    async listAll(user) {
        return this.listFullProducts(user);
    }
    async remove(user, id) {
        const userId = user.sub;
        if (!Number.isFinite(id) || id <= 0) {
            throw new common_1.BadRequestException({
                message: 'Invalid id',
                code: 'VALIDATION_ERROR',
            });
        }
        const byProduct = await this.prisma.wishlistItem.deleteMany({
            where: { userId, productId: id },
        });
        if (byProduct.count > 0)
            return;
        await this.prisma.wishlistItem.deleteMany({
            where: { userId, id },
        });
    }
    async removeByWishlistItemId(user, wishlistItemId) {
        return this.remove(user, wishlistItemId);
    }
};
exports.WishlistService = WishlistService;
exports.WishlistService = WishlistService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WishlistService);
//# sourceMappingURL=wishlist.service.js.map