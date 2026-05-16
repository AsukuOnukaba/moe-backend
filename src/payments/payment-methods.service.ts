import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { PaymentMethodDto } from './dto/payment-method.dto';

@Injectable()
export class PaymentMethodsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: number): Promise<{ data: PaymentMethodDto[]; total: number }> {
    const items = await this.prisma.paymentMethod.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return { data: items.map((item) => this.toDto(item)), total: items.length };
  }

  private parseExpiry(expiry: string): { month: number; year: number } {
    const match = /^(\d{2})\/(\d{2})$/.exec(expiry.trim());
    if (!match) {
      throw new BadRequestException({ message: 'Invalid expiry format', code: 'VALIDATION_ERROR' });
    }
    const month = Number(match[1]);
    const year = 2000 + Number(match[2]);
    return { month, year };
  }

  private assertNotExpired(month: number, year: number) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    if (year < currentYear || (year === currentYear && month < currentMonth)) {
      throw new BadRequestException({
        message: 'Card has expired',
        code: 'CARD_EXPIRED',
      });
    }
  }

  async create(userId: number, dto: CreatePaymentMethodDto): Promise<PaymentMethodDto> {
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

  async remove(id: string, userId: number): Promise<void> {
    const existing = await this.prisma.paymentMethod.findUnique({ where: { id } });
    if (!existing) {
      throw new BadRequestException({ message: 'Payment method not found' });
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException({ message: 'Forbidden' });
    }
    await this.prisma.paymentMethod.delete({ where: { id } });
  }

  async setDefault(id: string, userId: number): Promise<PaymentMethodDto> {
    const existing = await this.prisma.paymentMethod.findUnique({ where: { id } });
    if (!existing) {
      throw new BadRequestException({ message: 'Payment method not found' });
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException({ message: 'Forbidden' });
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

  private toDto(item: {
    id: string;
    brand: string;
    last4: string;
    expiry: string;
    cardholderName: string;
    billingAddressId: number | null;
    isDefault: boolean;
    createdAt: Date;
  }): PaymentMethodDto {
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
}
