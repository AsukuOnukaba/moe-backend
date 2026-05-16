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
exports.PaymentMethodsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../database/prisma.service");
let PaymentMethodsService = class PaymentMethodsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(userId) {
        const items = await this.prisma.paymentMethod.findMany({
            where: { userId },
            orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        });
        return { data: items.map((item) => this.toDto(item)), total: items.length };
    }
    parseExpiry(expiry) {
        const match = /^(\d{2})\/(\d{2})$/.exec(expiry.trim());
        if (!match) {
            throw new common_1.BadRequestException({ message: 'Invalid expiry format', code: 'VALIDATION_ERROR' });
        }
        const month = Number(match[1]);
        const year = 2000 + Number(match[2]);
        return { month, year };
    }
    assertNotExpired(month, year) {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        if (year < currentYear || (year === currentYear && month < currentMonth)) {
            throw new common_1.BadRequestException({
                message: 'Card has expired',
                code: 'CARD_EXPIRED',
            });
        }
    }
    async create(userId, dto) {
        const { month, year } = this.parseExpiry(dto.expiry);
        this.assertNotExpired(month, year);
        const created = await this.prisma.paymentMethod.create({
            data: {
                userId,
                brand: dto.brand,
                last4: dto.last4,
                expiry: dto.expiry,
                expiryMonth: month,
                expiryYear: year,
                processorToken: dto.processorToken ?? null,
                cardholderName: dto.cardholderName,
                billingAddressId: dto.billingAddressId,
                isDefault: false,
            },
        });
        return this.toDto(created);
    }
    async remove(id, userId) {
        const existing = await this.prisma.paymentMethod.findUnique({ where: { id } });
        if (!existing) {
            throw new common_1.BadRequestException({ message: 'Payment method not found' });
        }
        if (existing.userId !== userId) {
            throw new common_1.ForbiddenException({ message: 'Forbidden' });
        }
        await this.prisma.paymentMethod.delete({ where: { id } });
    }
    async setDefault(id, userId) {
        const existing = await this.prisma.paymentMethod.findUnique({ where: { id } });
        if (!existing) {
            throw new common_1.BadRequestException({ message: 'Payment method not found' });
        }
        if (existing.userId !== userId) {
            throw new common_1.ForbiddenException({ message: 'Forbidden' });
        }
        await this.prisma.paymentMethod.updateMany({
            where: { userId, id: { not: id } },
            data: { isDefault: false },
        });
        const updated = await this.prisma.paymentMethod.update({
            where: { id },
            data: { isDefault: true },
        });
        return this.toDto(updated);
    }
    toDto(item) {
        return {
            id: item.id,
            brand: item.brand,
            last4: item.last4,
            expiry: item.expiry,
            cardholderName: item.cardholderName,
            billingAddressId: item.billingAddressId,
            isDefault: item.isDefault,
            createdAt: item.createdAt,
        };
    }
};
exports.PaymentMethodsService = PaymentMethodsService;
exports.PaymentMethodsService = PaymentMethodsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PaymentMethodsService);
//# sourceMappingURL=payment-methods.service.js.map