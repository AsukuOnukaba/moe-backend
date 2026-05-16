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
            return (0, product_mapper_1.productToDto)(product);
        }
        await this.prisma.wishlistItem.create({ data: { userId, productId } });
        return (0, product_mapper_1.productToDto)(product);
    }
    async listFullProducts(user) {
        const userId = user.sub;
        const items = await this.prisma.wishlistItem.findMany({
            where: { userId },
            include: { product: true },
            orderBy: { addedAt: 'desc' },
        });
        return {
            data: items.map((item) => (0, product_mapper_1.productToDto)(item.product)),
            total: items.length,
        };
    }
    async listAll(user) {
        return this.listFullProducts(user);
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
    }
};
exports.WishlistService = WishlistService;
exports.WishlistService = WishlistService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WishlistService);
//# sourceMappingURL=wishlist.service.js.map