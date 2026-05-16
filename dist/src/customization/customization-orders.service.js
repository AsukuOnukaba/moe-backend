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
exports.CustomizationOrdersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../database/prisma.service");
const product_customisation_templates_1 = require("../products/product-customisation.templates");
const customizationStore = new Map();
let customizationIdSeq = 1;
let CustomizationOrdersService = class CustomizationOrdersService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(customer, body) {
        const productId = Number(body?.productId ?? 0);
        if (!productId) {
            return { message: 'Missing productId', code: 'VALIDATION_ERROR' };
        }
        const product = await this.prisma.product.findUnique({ where: { id: productId } });
        if (!product?.category) {
            throw new common_1.BadRequestException({ message: 'Product category required for customisation' });
        }
        const customisation = body.customisation ??
            body.customization ??
            body.measurements ??
            {};
        const validation = (0, product_customisation_templates_1.validateCustomisationPayload)(product.category, customisation);
        if (!validation.valid) {
            throw new common_1.BadRequestException({
                message: `Unknown customisation keys: ${validation.unknownKeys.join(', ')}`,
                code: 'INVALID_CUSTOMISATION',
            });
        }
        const now = new Date().toISOString();
        const customization = {
            id: customizationIdSeq++,
            productId,
            customerId: customer.sub,
            selectedVariants: body.selectedVariants ?? {},
            selectedSize: typeof body.selectedSize === 'string' ? body.selectedSize : '',
            selectedBodyType: body.selectedBodyType ?? null,
            selectedFootType: body.selectedFootType ?? null,
            measurements: body.measurements ?? {},
            customisation,
            notes: typeof body.notes === 'string' ? body.notes : null,
            basePrice: Number(body.basePrice ?? 0),
            variantModifierTotal: Number(body.variantModifierTotal ?? 0),
            customizationFee: Number(body.customizationFee ?? 0),
            finalPrice: Number(body.finalPrice ?? 0),
            rushOrder: Boolean(body.rushOrder ?? false),
            rushOrderCost: Number(body.rushOrderCost ?? 0),
            estimatedDeliveryDays: Number(body.estimatedDeliveryDays ?? 7),
            status: 'submitted',
            createdAt: now,
            updatedAt: now,
        };
        customizationStore.set(customization.id, customization);
        return customization;
    }
    async getById(customer, id) {
        const item = customizationStore.get(id);
        if (!item || item.customerId !== customer.sub) {
            throw new common_1.NotFoundException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });
        }
        return item;
    }
    async createCustomRequest(_customer, _body) {
        return { id: customizationIdSeq++, status: 'pending_review' };
    }
};
exports.CustomizationOrdersService = CustomizationOrdersService;
exports.CustomizationOrdersService = CustomizationOrdersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CustomizationOrdersService);
//# sourceMappingURL=customization-orders.service.js.map