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
exports.ArtisansService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../database/prisma.service");
const product_mapper_1 = require("../common/product-mapper");
function asArrayFromComma(value) {
    if (!value)
        return [];
    return value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}
let ArtisansService = class ArtisansService {
    prisma;
    config;
    constructor(prisma, config) {
        this.prisma = prisma;
        this.config = config;
    }
    requireArtisan(user) {
        if (!user || user.role !== 'artisan') {
            throw new common_1.ForbiddenException({
                message: 'Forbidden',
                code: 'RESOURCE_NOT_FOUND',
            });
        }
        return user.sub;
    }
    async getMe(user) {
        const userId = this.requireArtisan(user);
        const artisanProfile = await this.prisma.artisanProfile.findUnique({
            where: { userId },
        });
        if (!artisanProfile)
            throw new common_1.NotFoundException({
                message: 'Not found',
                code: 'RESOURCE_NOT_FOUND',
            });
        const u = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!u)
            throw new common_1.NotFoundException({
                message: 'Not found',
                code: 'RESOURCE_NOT_FOUND',
            });
        return {
            id: artisanProfile.userId,
            providerId: artisanProfile.userId,
            brandName: artisanProfile.brandName ?? u.name,
            businessName: artisanProfile.businessName ?? null,
            firstName: artisanProfile.firstName,
            lastName: artisanProfile.lastName,
            about: artisanProfile.about ?? null,
            description: artisanProfile.description ?? null,
            city: artisanProfile.city ?? null,
            state: artisanProfile.state ?? null,
            country: artisanProfile.country ?? null,
            address: artisanProfile.address ?? null,
            phone: u.phone ?? null,
            email: u.email,
            rating: artisanProfile.rating ?? 0,
            reviewCount: artisanProfile.reviewCount ?? 0,
            verified: artisanProfile.verified ?? false,
            featured: artisanProfile.featured ?? false,
            estimatedDeliveryDays: artisanProfile.estimatedDeliveryDays ?? 7,
            heroImage: artisanProfile.heroImage ?? null,
            storeImageUrl: artisanProfile.storeImageUrl ?? null,
            coverImageUrl: artisanProfile.coverImageUrl ?? null,
            customOrdersEnabled: artisanProfile.customOrdersEnabled ?? false,
            rushOrderEnabled: artisanProfile.rushOrderEnabled ?? false,
            rushOrderSurchargePercent: artisanProfile.rushOrderSurchargePercent ?? 25,
            status: artisanProfile.status ?? 'pending',
            category: artisanProfile.category ?? null,
            styleTags: asArrayFromComma(artisanProfile.styleTags),
            serviceCategories: asArrayFromComma(artisanProfile.serviceCategories),
        };
    }
    async patchMe(user, dto) {
        const userId = this.requireArtisan(user);
        const upserted = await this.prisma.artisanProfile.upsert({
            where: { userId },
            create: {
                userId,
                brandName: dto.brandName ?? undefined,
                businessName: dto.businessName ?? undefined,
                description: dto.description ?? undefined,
                heroImage: dto.heroImage ?? null,
                storeImageUrl: dto.storeImageUrl ?? null,
                country: dto.country ?? undefined,
                address: dto.address ?? undefined,
            },
            update: {
                ...(dto.brandName !== undefined ? { brandName: dto.brandName } : {}),
                ...(dto.businessName !== undefined
                    ? { businessName: dto.businessName }
                    : {}),
                ...(dto.description !== undefined
                    ? { description: dto.description }
                    : {}),
                ...(dto.about !== undefined ? { about: dto.about } : {}),
                ...(dto.country !== undefined ? { country: dto.country } : {}),
                ...(dto.address !== undefined ? { address: dto.address } : {}),
                ...(dto.city !== undefined ? { city: dto.city } : {}),
                ...(dto.state !== undefined ? { state: dto.state } : {}),
                ...(dto.category !== undefined ? { category: dto.category } : {}),
                ...(dto.styleTags !== undefined ? { styleTags: dto.styleTags } : {}),
                ...(dto.serviceCategories !== undefined
                    ? { serviceCategories: dto.serviceCategories }
                    : {}),
                ...(dto.heroImage !== undefined ? { heroImage: dto.heroImage } : {}),
                ...(dto.storeImageUrl !== undefined
                    ? { storeImageUrl: dto.storeImageUrl }
                    : {}),
                ...(dto.coverImageUrl !== undefined
                    ? { coverImageUrl: dto.coverImageUrl }
                    : {}),
                ...(dto.images !== undefined && dto.images !== null
                    ? { images: dto.images }
                    : {}),
                ...(dto.customOrdersEnabled !== undefined
                    ? { customOrdersEnabled: dto.customOrdersEnabled }
                    : {}),
                ...(dto.rushOrderEnabled !== undefined
                    ? { rushOrderEnabled: dto.rushOrderEnabled }
                    : {}),
                ...(dto.rushOrderSurchargePercent !== undefined
                    ? { rushOrderSurchargePercent: dto.rushOrderSurchargePercent }
                    : {}),
                ...(dto.verified !== undefined ? { verified: dto.verified } : {}),
                ...(dto.featured !== undefined ? { featured: dto.featured } : {}),
                ...(dto.estimatedDeliveryDays !== undefined
                    ? { estimatedDeliveryDays: dto.estimatedDeliveryDays }
                    : {}),
            },
        });
        const u = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!u)
            throw new common_1.NotFoundException({
                message: 'Not found',
                code: 'RESOURCE_NOT_FOUND',
            });
        return {
            id: upserted.userId,
            brandName: upserted.brandName ?? u.name,
            firstName: upserted.firstName,
            lastName: upserted.lastName,
            about: upserted.about ?? null,
            city: upserted.city ?? null,
            state: upserted.state ?? null,
            phone: u.phone ?? null,
            email: u.email,
            rating: upserted.rating ?? 0,
            reviewCount: upserted.reviewCount ?? 0,
            verified: upserted.verified ?? false,
            featured: upserted.featured ?? false,
            estimatedDeliveryDays: upserted.estimatedDeliveryDays ?? 7,
            heroImage: upserted.heroImage ?? null,
            storeImageUrl: upserted.storeImageUrl ?? null,
            coverImageUrl: upserted.coverImageUrl ?? null,
            customOrdersEnabled: upserted.customOrdersEnabled ?? false,
            rushOrderEnabled: upserted.rushOrderEnabled ?? false,
            rushOrderSurchargePercent: upserted.rushOrderSurchargePercent ?? 25,
            status: upserted.status ?? 'pending',
            category: upserted.category ?? null,
            styleTags: asArrayFromComma(upserted.styleTags),
            serviceCategories: asArrayFromComma(upserted.serviceCategories),
        };
    }
    async listProducts(user, page, pageSize) {
        const userId = this.requireArtisan(user);
        const safePage = Math.max(1, page);
        const safePageSize = Math.max(1, Math.min(100, pageSize));
        const totalItems = await this.prisma.product.count({
            where: { providerId: userId },
        });
        const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
        const items = await this.prisma.product.findMany({
            where: { providerId: userId },
            orderBy: { updatedAt: 'desc' },
            skip: (safePage - 1) * safePageSize,
            take: safePageSize,
        });
        return {
            data: items.map((p) => (0, product_mapper_1.productToDto)(p)),
            pagination: {
                page: safePage,
                pageSize: safePageSize,
                totalPages,
                totalItems,
            },
        };
    }
    async createProduct(user, dto) {
        const userId = this.requireArtisan(user);
        const created = await this.prisma.product.create({
            data: {
                providerId: userId,
                name: dto.name,
                description: dto.description ?? null,
                price: dto.priceMin ?? dto.price ?? 0,
                originalPrice: dto.priceMax ?? dto.originalPrice ?? null,
                currency: dto.currency ?? 'NGN',
                images: dto.images ?? [],
                category: dto.category ?? null,
                materials: dto.materials ?? null,
                tags: dto.tags ?? null,
                featured: dto.featured ?? false,
                isBestSeller: dto.isBestSeller ?? false,
                isTrending: dto.isTrending ?? false,
                isNewArrival: dto.isNewArrival ?? false,
                discountPercent: dto.discountPercent ?? null,
                estimatedDeliveryDays: dto.estimatedDeliveryDays ?? 7,
                status: 'pending',
            },
        });
        return (0, product_mapper_1.productToDto)(created);
    }
    async patchProduct(user, productId, dto) {
        const userId = this.requireArtisan(user);
        const existing = await this.prisma.product.findFirst({
            where: { id: productId, providerId: userId },
        });
        if (!existing) {
            throw new common_1.NotFoundException({
                message: 'Not found',
                code: 'RESOURCE_NOT_FOUND',
            });
        }
        const updated = await this.prisma.product.update({
            where: { id: productId },
            data: {
                ...(dto.name !== undefined ? { name: dto.name } : {}),
                ...(dto.description !== undefined
                    ? { description: dto.description }
                    : {}),
                ...(dto.priceMin !== undefined
                    ? { price: dto.priceMin }
                    : dto.price !== undefined
                        ? { price: dto.price }
                        : {}),
                ...(dto.priceMax !== undefined
                    ? { originalPrice: dto.priceMax }
                    : dto.originalPrice !== undefined
                        ? { originalPrice: dto.originalPrice }
                        : {}),
                ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
                ...(dto.images !== undefined ? { images: dto.images ?? [] } : {}),
                ...(dto.category !== undefined ? { category: dto.category } : {}),
                ...(dto.materials !== undefined ? { materials: dto.materials } : {}),
                ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
                ...(dto.featured !== undefined ? { featured: dto.featured } : {}),
                ...(dto.isBestSeller !== undefined
                    ? { isBestSeller: dto.isBestSeller }
                    : {}),
                ...(dto.isTrending !== undefined ? { isTrending: dto.isTrending } : {}),
                ...(dto.isNewArrival !== undefined
                    ? { isNewArrival: dto.isNewArrival }
                    : {}),
                ...(dto.discountPercent !== undefined
                    ? { discountPercent: dto.discountPercent }
                    : {}),
                ...(dto.estimatedDeliveryDays !== undefined
                    ? { estimatedDeliveryDays: dto.estimatedDeliveryDays }
                    : {}),
            },
        });
        return (0, product_mapper_1.productToDto)(updated);
    }
    async deleteProduct(user, productId) {
        const userId = this.requireArtisan(user);
        const existing = await this.prisma.product.findFirst({
            where: { id: productId, providerId: userId },
        });
        if (!existing) {
            throw new common_1.NotFoundException({
                message: 'Not found',
                code: 'RESOURCE_NOT_FOUND',
            });
        }
        await this.prisma.product.delete({ where: { id: productId } });
        return { success: true };
    }
    async getFilterMeta() {
        const [categories, serviceCategoryRows, locationRows] = await Promise.all([
            this.prisma.artisanProfile.findMany({
                where: { status: 'approved' },
                distinct: ['category'],
                select: { category: true },
            }),
            this.prisma.artisanProfile.findMany({
                where: { status: 'approved', serviceCategories: { not: null } },
                select: { serviceCategories: true },
            }),
            this.prisma.artisanProfile.findMany({
                where: { status: 'approved' },
                select: { location: true, city: true },
            }),
        ]);
        const serviceCategories = new Set();
        for (const row of serviceCategoryRows) {
            for (const item of asArrayFromComma(row.serviceCategories)) {
                serviceCategories.add(item);
            }
        }
        const locations = new Set();
        for (const row of locationRows) {
            if (row.location)
                locations.add(row.location);
            if (row.city)
                locations.add(row.city);
        }
        return {
            categories: categories
                .map((c) => c.category)
                .filter((c) => Boolean(c))
                .sort(),
            serviceCategories: [...serviceCategories].sort(),
            locations: [...locations].sort(),
        };
    }
    async getRushOrderConfig(artisanId) {
        const profile = await this.prisma.artisanProfile.findUnique({
            where: { userId: artisanId },
        });
        if (!profile) {
            throw new common_1.NotFoundException({
                message: 'Not found',
                code: 'RESOURCE_NOT_FOUND',
            });
        }
        return {
            rushOrderEnabled: profile.rushOrderEnabled ?? false,
            surchargePercent: profile.rushOrderSurchargePercent ?? 25,
        };
    }
    async getAll(page, pageSize, category) {
        const safePage = Math.max(1, page ?? 1);
        const safePageSize = Math.max(1, Math.min(100, pageSize ?? 20));
        const where = { status: 'approved' };
        if (category) {
            where.category = {
                equals: category,
                mode: 'insensitive',
            };
        }
        const totalItems = await this.prisma.artisanProfile.count({ where });
        const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
        const artisans = await this.prisma.artisanProfile.findMany({
            where,
            skip: (safePage - 1) * safePageSize,
            take: safePageSize,
            orderBy: { rating: 'desc' },
            include: {
                user: true,
            },
        });
        const data = artisans.map((a) => ({
            id: a.userId,
            name: a.user.name,
            brandName: a.brandName ?? a.user.name,
            businessName: a.businessName ?? null,
            description: a.description ?? null,
            location: a.location ?? null,
            category: a.category ?? null,
            images: a.images ?? [],
            heroImage: a.heroImage ?? null,
            rating: a.rating ?? 0,
            reviewCount: a.reviewCount ?? 0,
            verified: a.verified ?? false,
            featured: a.featured ?? false,
        }));
        return {
            data,
            pagination: {
                page: safePage,
                pageSize: safePageSize,
                totalPages,
                totalItems,
            },
        };
    }
};
exports.ArtisansService = ArtisansService;
exports.ArtisansService = ArtisansService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], ArtisansService);
//# sourceMappingURL=artisans.service.js.map