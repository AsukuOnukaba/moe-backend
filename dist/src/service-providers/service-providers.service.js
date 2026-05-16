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
exports.ServiceProvidersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../database/prisma.service");
const product_mapper_1 = require("../common/product-mapper");
function splitCsv(value) {
    return (0, product_mapper_1.toTagArray)(value);
}
let ServiceProvidersService = class ServiceProvidersService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listPublicInfo(query) {
        const page = Math.max(1, Number(query?.page ?? 1));
        const pageSize = Math.max(1, Math.min(100, Number(query?.pageSize ?? 20)));
        const skip = (page - 1) * pageSize;
        const category = typeof query?.category === 'string' ? query.category.trim() : undefined;
        const location = typeof query?.location === 'string' ? query.location.trim() : undefined;
        const serviceCategories = typeof query?.serviceCategories === 'string'
            ? query.serviceCategories.split(',').map((s) => s.trim()).filter(Boolean)
            : Array.isArray(query?.serviceCategories)
                ? query.serviceCategories.map((s) => String(s).trim()).filter(Boolean)
                : [];
        const artisans = await this.prisma.userRole.findMany({
            where: { role: { name: 'artisan' } },
            include: { user: { include: { artisanProfile: true } } },
            take: 1000,
        });
        let providers = artisans
            .map((ur) => ur.user)
            .filter((u) => u.artisanProfile?.status === 'approved')
            .map((u) => this.userToProvider(u, u.artisanProfile));
        if (category) {
            providers = providers.filter((p) => p.category?.toLowerCase() === category.toLowerCase());
        }
        if (location) {
            const loc = location.toLowerCase();
            providers = providers.filter((p) => p.city?.toLowerCase().includes(loc) ||
                p.location?.toLowerCase().includes(loc));
        }
        if (serviceCategories.length > 0) {
            providers = providers.filter((p) => serviceCategories.some((sc) => p.serviceCategories.some((existing) => existing.toLowerCase() === sc.toLowerCase())));
        }
        const totalItems = providers.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
        const pageItems = providers.slice(skip, skip + pageSize);
        return {
            data: pageItems,
            pagination: { page, pageSize, totalPages, totalItems },
        };
    }
    async getProviderPublicInfo(id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            include: { artisanProfile: true },
        });
        if (!user || !user.artisanProfile || user.artisanProfile.status !== 'approved') {
            throw new common_1.NotFoundException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });
        }
        return this.userToProvider(user, user.artisanProfile);
    }
    async listProductsByProvider(providerId, query) {
        const products = await this.prisma.product.findMany({
            where: { providerId, status: 'approved' },
            orderBy: { updatedAt: 'desc' },
            skip: (Math.max(1, Number(query?.page ?? 1)) - 1) * Math.max(1, Number(query?.pageSize ?? 20)),
            take: Math.max(1, Number(query?.pageSize ?? 20)),
        });
        const page = Math.max(1, Number(query?.page ?? 1));
        const pageSize = Math.max(1, Number(query?.pageSize ?? 20));
        const totalItems = await this.prisma.product.count({
            where: { providerId, status: 'approved' },
        });
        const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
        const data = products.map((p) => (0, product_mapper_1.productToDto)(p));
        return {
            data,
            pagination: { page, pageSize, totalPages, totalItems },
        };
    }
    async recommendations() {
        const providers = await this.listPublicInfo({ page: 1, pageSize: 10 });
        return providers;
    }
    userToProvider(user, ap) {
        return {
            id: user.id,
            providerId: user.id,
            brandName: ap.brandName ?? user.name,
            businessName: ap.businessName ?? null,
            firstName: ap.firstName ?? null,
            lastName: ap.lastName ?? null,
            about: ap.about ?? null,
            description: ap.description ?? null,
            city: ap.city ?? null,
            state: ap.state ?? null,
            country: ap.country ?? null,
            address: ap.address ?? null,
            phone: user.phone ?? null,
            email: user.email,
            rating: ap.rating ?? 0,
            reviewCount: ap.reviewCount ?? 0,
            verified: ap.verified ?? false,
            featured: ap.featured ?? false,
            estimatedDeliveryDays: ap.estimatedDeliveryDays ?? 7,
            heroImage: ap.heroImage ?? null,
            storeImageUrl: ap.storeImageUrl ?? null,
            coverImageUrl: ap.coverImageUrl ?? null,
            customOrdersEnabled: ap.customOrdersEnabled ?? false,
            category: ap.category ?? null,
            location: ap.location ?? ap.city ?? null,
            styleTags: splitCsv(ap.styleTags),
            serviceCategories: splitCsv(ap.serviceCategories),
        };
    }
};
exports.ServiceProvidersService = ServiceProvidersService;
exports.ServiceProvidersService = ServiceProvidersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ServiceProvidersService);
//# sourceMappingURL=service-providers.service.js.map