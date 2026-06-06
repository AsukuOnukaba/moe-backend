import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';

export type CheckoutPaymentMethodDto = {
  id: string;
  brand: string;
  last4: string;
  expiry: string;
  isDefault: boolean;
};

@Injectable()
export class PaymentMethodsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForCheckout(userId: number): Promise<{ data: CheckoutPaymentMethodDto[] }> {
    const items = await this.prisma.paymentMethod.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return { data: items.map((item) => this.toCheckoutDto(item)) };
  }

  async findAll(userId: number) {
    const result = await this.listForCheckout(userId);
    return { ...result, total: result.data.length };
  }

  parseExpiry(expiry: string): { month: number; year: number; formatted: string } {
    const trimmed = expiry.trim();
    const match = /^(\d{2})\/(\d{2}|\d{4})$/.exec(trimmed);
    if (!match) {
      throw new BadRequestException({ message: 'Invalid expiry format', code: 'VALIDATION_ERROR' });
    }
    const month = Number(match[1]);
    const yearPart = match[2];
    const year = yearPart.length === 2 ? 2000 + Number(yearPart) : Number(yearPart);
    const formatted =
      yearPart.length === 2 ? `${match[1]}/${yearPart}` : `${match[1]}/${String(year).slice(-2)}`;
    return { month, year, formatted };
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

  async create(userId: number, dto: CreatePaymentMethodDto): Promise<CheckoutPaymentMethodDto> {
    const { month, year, formatted } = this.parseExpiry(dto.expiry);
    this.assertNotExpired(month, year);

    const isFirst = (await this.prisma.paymentMethod.count({ where: { userId } })) === 0;

    const created = await this.prisma.paymentMethod.create({
      data: {
        userId,
        brand: dto.brand.toLowerCase(),
        last4: dto.last4,
        expiry: formatted,
        expiryMonth: month,
        expiryYear: year,
        processorToken: dto.processorToken ?? null,
        cardholderName: dto.cardholderName,
        billingAddressId: dto.billingAddressId,
        isDefault: isFirst,
      },
    });

    return this.toCheckoutDto(created);
  }

  async createFromGateway(input: {
    userId: number;
    gatewayToken: string;
    brand: string;
    last4: string;
    expiry: string;
    cardholderName: string;
  }): Promise<CheckoutPaymentMethodDto> {
    return this.create(input.userId, {
      brand: input.brand,
      last4: input.last4,
      expiry: input.expiry,
      cardholderName: input.cardholderName,
      processorToken: input.gatewayToken,
    });
  }

  async assertOwnedByUser(paymentMethodId: string, userId: number) {
    const existing = await this.prisma.paymentMethod.findUnique({
      where: { id: paymentMethodId },
    });
    if (!existing) {
      throw new BadRequestException({
        message: 'Payment method not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException({ message: 'Forbidden', code: 'FORBIDDEN' });
    }
    return existing;
  }

  async remove(id: string, userId: number): Promise<void> {
    await this.assertOwnedByUser(id, userId);
    await this.prisma.paymentMethod.delete({ where: { id } });
  }

  async setDefault(id: string, userId: number): Promise<CheckoutPaymentMethodDto> {
    await this.assertOwnedByUser(id, userId);

    await this.prisma.paymentMethod.updateMany({
      where: { userId, id: { not: id } },
      data: { isDefault: false },
    });

    const updated = await this.prisma.paymentMethod.update({
      where: { id },
      data: { isDefault: true },
    });

    return this.toCheckoutDto(updated);
  }

  private toCheckoutDto(item: {
    id: string;
    brand: string;
    last4: string;
    expiry: string;
    isDefault: boolean;
  }): CheckoutPaymentMethodDto {
    return {
      id: item.id,
      brand: item.brand.toLowerCase(),
      last4: item.last4,
      expiry: item.expiry,
      isDefault: item.isDefault,
    };
  }
}
