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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceProvidersController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const service_providers_service_1 = require("./service-providers.service");
const reviewStore = new Map();
let reviewIdSeq = 1;
let ServiceProvidersController = class ServiceProvidersController {
    providers;
    constructor(providers) {
        this.providers = providers;
    }
    listPublicInfo(query) {
        return this.providers.listPublicInfo(query);
    }
    getPublicInfo(id) {
        return this.providers.getProviderPublicInfo(Number(id));
    }
    productsByProvider(id, query) {
        return this.providers.listProductsByProvider(Number(id), query);
    }
    recommendations() {
        return this.providers.recommendations();
    }
    listReviews(id, query) {
        const providerId = Number(id);
        const all = reviewStore.get(providerId) ?? [];
        const page = Math.max(1, Number(query?.page ?? 1));
        const pageSize = Math.max(1, Math.min(100, Number(query?.pageSize ?? 20)));
        const skip = (page - 1) * pageSize;
        const items = all.slice(skip, skip + pageSize);
        const totalItems = all.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
        return {
            data: items,
            pagination: { page, pageSize, totalPages, totalItems },
        };
    }
    async createReview(id, req, body) {
        const providerId = Number(id);
        const user = req.user;
        const customerId = user?.sub;
        if (!customerId) {
            return { message: 'Unauthorized', code: 'AUTH_TOKEN_EXPIRED' };
        }
        const rating = Math.max(1, Math.min(5, Number(body?.rating ?? 5)));
        const comment = typeof body?.comment === 'string' ? body.comment : '';
        const createdAt = new Date().toISOString();
        const review = {
            id: reviewIdSeq++,
            providerId,
            customerId,
            orderId: body?.orderId ?? null,
            rating,
            comment,
            createdAt,
        };
        const arr = reviewStore.get(providerId) ?? [];
        reviewStore.set(providerId, [...arr, review]);
        return review;
    }
};
exports.ServiceProvidersController = ServiceProvidersController;
__decorate([
    (0, common_1.Get)('public-info'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ServiceProvidersController.prototype, "listPublicInfo", null);
__decorate([
    (0, common_1.Get)(':id/public-info'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ServiceProvidersController.prototype, "getPublicInfo", null);
__decorate([
    (0, common_1.Get)(':id/products'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ServiceProvidersController.prototype, "productsByProvider", null);
__decorate([
    (0, common_1.Get)('recommendations'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ServiceProvidersController.prototype, "recommendations", null);
__decorate([
    (0, common_1.Get)(':id/reviews'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ServiceProvidersController.prototype, "listReviews", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)(':id/reviews'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ServiceProvidersController.prototype, "createReview", null);
exports.ServiceProvidersController = ServiceProvidersController = __decorate([
    (0, common_1.Controller)('service-providers'),
    __metadata("design:paramtypes", [service_providers_service_1.ServiceProvidersService])
], ServiceProvidersController);
//# sourceMappingURL=service-providers.controller.js.map