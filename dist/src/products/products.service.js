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
const product_mapper_1 = require("../common/product-mapper");
const product_customisation_templates_1 = require("./product-customisation.templates");
const APPROVED_STATUS = 'approved';
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
        const where = { status: APPROVED_STATUS };
        if (category)
            where.category = category;
        if (featured !== undefined)
            where.featured = featured;
        const styleTags = typeof query?.styleTags === 'string'
            ? query.styleTags.split(',').map((s) => s.trim()).filter(Boolean)
            : Array.isArray(query?.styleTags)
                ? query.styleTags.map((s) => String(s).trim()).filter(Boolean)
                : [];
        if (styleTags.length > 0) {
            where.AND = styleTags.map((tag) => ({
                tags: { contains: tag, mode: 'insensitive' },
            }));
        }
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
            data: items.map(product_mapper_1.productToDto),
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
        const p = await this.prisma.product.findFirst({
            where: { id, status: APPROVED_STATUS },
        });
        if (!p)
            return null;
        return (0, product_mapper_1.productToDto)(p);
    }
    async getCustomisationTemplate(category) {
        return { category, fields: (0, product_customisation_templates_1.getCustomisationTemplate)(category) };
    }
    async getFilterMeta() {
        const approved = { status: APPROVED_STATUS };
        const [categories, tagRows, priceAgg, deliveryRows] = await Promise.all([
            this.prisma.product.findMany({
                where: approved,
                distinct: ['category'],
                select: { category: true },
            }),
            this.prisma.product.findMany({
                where: { ...approved, tags: { not: null } },
                select: { tags: true },
            }),
            this.prisma.product.aggregate({
                where: approved,
                _min: { price: true },
                _max: { price: true },
            }),
            this.prisma.product.findMany({
                where: approved,
                distinct: ['estimatedDeliveryDays'],
                select: { estimatedDeliveryDays: true },
            }),
        ]);
        const styleTagSet = new Set();
        for (const row of tagRows) {
            if (!row.tags)
                continue;
            for (const tag of row.tags.split(',')) {
                const t = tag.trim();
                if (t)
                    styleTagSet.add(t);
            }
        }
        return {
            categories: categories
                .map((c) => c.category)
                .filter((c) => Boolean(c))
                .sort(),
            styleTags: [...styleTagSet].sort(),
            priceRange: {
                min: priceAgg._min.price ?? 0,
                max: priceAgg._max.price ?? 0,
            },
            deliveryDays: deliveryRows
                .map((d) => d.estimatedDeliveryDays)
                .filter((d) => d != null)
                .sort((a, b) => a - b),
        };
    }
    async recommendations(query) {
        const page = Math.max(1, Number(query?.page ?? 1));
        const pageSize = Math.max(1, Math.min(100, Number(query?.pageSize ?? 10)));
        const skip = (page - 1) * pageSize;
        const items = await this.prisma.product.findMany({
            where: { status: APPROVED_STATUS },
            orderBy: { updatedAt: 'desc' },
            skip,
            take: pageSize,
        });
        const totalItems = items.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
        return {
            data: items.map(product_mapper_1.productToDto),
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
            data: items.map(product_mapper_1.productToDto),
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