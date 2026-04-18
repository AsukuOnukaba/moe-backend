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

    const data = items.map((item) => this.toDto(item));
    return { data, total: items.length };
  }

  async create(userId: number, dto: CreatePaymentMethodDto): Promise<PaymentMethodDto> {
    // TODO: In production, this should accept only a Paystack/Stripe token
    // Raw PAN/CVV must NEVER reach the backend
    // Only safe fields are stored: brand, last4, expiry, cardholderName, billingAddressId

    const created = await this.prisma.paymentMethod.create({
      data: {
        userId,
        brand: dto.brand,
        last4: dto.last4,
        expiry: dto.expiry,
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

    // Clear all other defaults for this user
    await this.prisma.paymentMethod.updateMany({
      where: { userId, id: { not: id } },
      data: { isDefault: false },
    });

    // Set this one as default
    const updated = await this.prisma.paymentMethod.update({
      where: { id },
      data: { isDefault: true },
    });

    return this.toDto(updated);
  }

  private toDto(item: any): PaymentMethodDto {
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
