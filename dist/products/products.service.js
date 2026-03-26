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
exports.ProductsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../database/prisma.service");
function toTagArray(value) {
    if (!value)
        return [];
    return value.split(',').map((s) => s.trim()).filter(Boolean);
}
function productToDto(p) {
    const price = typeof p.price === 'number' ? p.price : 0;
    return {
        id: p.id,
        name: p.name,
        description: p.description ?? '',
        priceRange: { min: price, max: price },
        currency: p.currency ?? 'NGN',
        estimatedDeliveryDays: p.estimatedDeliveryDays ?? 7,
        materials: p.materials ?? '',
        tags: toTagArray(p.tags ?? null),
        images: p.imageUrl ? [p.imageUrl] : [],
        category: p.category ?? null,
        providerId: p.providerId,
        featured: p.featured ?? false,
        isBestSeller: p.isBestSeller ?? false,
        isTrending: p.isTrending ?? false,
        isNewArrival: p.isNewArrival ?? false,
        discountPercent: p.discountPercent ?? null,
        originalPrice: p.originalPrice ?? null,
    };
}
let ProductsService = class ProductsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listProducts(query) {
        const page = Math.max(1, Number(query?.page ?? 1));
        const pageSize = Math.max(1, Math.min(100, Number(query?.pageSize ?? 20)));
        const skip = (page - 1) * pageSize;
        const q = typeof query?.q === 'string' ? query.q.trim() : '';
        const category = typeof query?.category === 'string' ? query.category : undefined;
        const featured = query?.featured === 'true' ? true : query?.featured === 'false' ? false : undefined;
        const priceMin = query?.priceMin !== undefined ? Number(query.priceMin) : undefined;
        const priceMax = query?.priceMax !== undefined ? Number(query.priceMax) : undefined;
        const where = {};
        if (category)
            where.category = category;
        if (featured !== undefined)
            where.featured = featured;
        if (priceMin !== undefined || priceMax !== undefined) {
            where.price = {};
            if (priceMin !== undefined)
                where.price.gte = priceMin;
            if (priceMax !== undefined)
                where.price.lte = priceMax;
        }
        if (q.length >= 2) {
            where.OR = [
                { name: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
                { materials: { contains: q, mode: 'insensitive' } },
                { tags: { contains: q, mode: 'insensitive' } },
            ];
        }
        const [totalItems, items] = await Promise.all([
            this.prisma.product.count({ where }),
            this.prisma.product.findMany({
                where,
                orderBy: this.getSort(query),
                skip,
                take: pageSize,
            }),
        ]);
        const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
        const pagination = { page, pageSize, totalPages, totalItems };
        return {
            data: items.map(productToDto),
            pagination,
        };
    }
    getSort(query) {
        const sort = typeof query?.sort === 'string' ? query.sort : '';
        switch (sort) {
            case 'price_asc':
                return { price: 'asc' };
            case 'price_desc':
                return { price: 'desc' };
            case 'newest':
                return { updatedAt: 'desc' };
            default:
                return { updatedAt: 'desc' };
        }
    }
    async getProductById(id) {
        const p = await this.prisma.product.findUnique({ where: { id } });
        if (!p)
            return null;
        return productToDto(p);
    }
    async recommendations(query) {
        const page = Math.max(1, Number(query?.page ?? 1));
        const pageSize = Math.max(1, Math.min(100, Number(query?.pageSize ?? 10)));
        const skip = (page - 1) * pageSize;
        const items = await this.prisma.product.findMany({
            orderBy: { updatedAt: 'desc' },
            skip,
            take: pageSize,
        });
        const totalItems = items.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
        return {
            data: items.map(productToDto),
            pagination: { page, pageSize, totalPages, totalItems },
        };
    }
    async variants(_productId) {
        return [];
    }
    async listProductsByProvider(providerId, query) {
        const page = Math.max(1, Number(query?.page ?? 1));
        const pageSize = Math.max(1, Math.min(100, Number(query?.pageSize ?? 20)));
        const skip = (page - 1) * pageSize;
        const totalItems = await this.prisma.product.count({ where: { providerId } });
        const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
        const items = await this.prisma.product.findMany({
            where: { providerId },
            orderBy: { updatedAt: 'desc' },
            skip,
            take: pageSize,
        });
        return {
            data: items.map(productToDto),
            pagination: { page, pageSize, totalPages, totalItems },
        };
    }
};
exports.ProductsService = ProductsService;
exports.ProductsService = ProductsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProductsService);
//# sourceMappingURL=products.service.js.map