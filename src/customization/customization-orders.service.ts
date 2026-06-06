import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { validateCustomisationPayload } from '../products/product-customisation.templates';

type CustomizationOrder = {
  id: number;
  productId: number;
  customerId: number;
  selectedVariants: Record<string, unknown>;
  selectedSize: string;
  selectedBodyType: string | null;
  selectedFootType: string | null;
  measurements: Record<string, unknown>;
  customisation: Record<string, unknown>;
  notes: string | null;
  basePrice: number;
  variantModifierTotal: number;
  customizationFee: number;
  finalPrice: number;
  rushOrder: boolean;
  rushOrderCost: number;
  estimatedDeliveryDays: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

const customizationStore = new Map<number, CustomizationOrder>();
let customizationIdSeq = 1;

@Injectable()
export class CustomizationOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(customer: { sub: number }, body: Record<string, unknown>) {
    const productId = Number(body?.productId ?? 0);
    if (!productId) {
      return { message: 'Missing productId', code: 'VALIDATION_ERROR' };
    }

    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
    });
    if (!product?.category) {
      throw new BadRequestException({ message: 'Product category required for customisation' });
    }

    const customisation =
      (body.customisation as Record<string, unknown>) ??
      (body.customization as Record<string, unknown>) ??
      (body.measurements as Record<string, unknown>) ??
      {};

    const validation = validateCustomisationPayload(product.category, customisation);
    if (!validation.valid) {
      const parts: string[] = [];
      if (validation.unknownKeys.length) {
        parts.push(`unknown keys: ${validation.unknownKeys.join(', ')}`);
      }
      if (validation.missingRequired.length) {
        parts.push(`missing required: ${validation.missingRequired.join(', ')}`);
      }
      throw new BadRequestException({
        message: `Invalid customisation (${parts.join('; ')})`,
        code: 'INVALID_CUSTOMISATION',
      });
    }

    const now = new Date().toISOString();
    const customization: CustomizationOrder = {
      id: customizationIdSeq++,
      productId,
      customerId: customer.sub,
      selectedVariants: (body.selectedVariants as Record<string, unknown>) ?? {},
      selectedSize: typeof body.selectedSize === 'string' ? body.selectedSize : '',
      selectedBodyType: (body.selectedBodyType as string | null) ?? null,
      selectedFootType: (body.selectedFootType as string | null) ?? null,
      measurements: (body.measurements as Record<string, unknown>) ?? {},
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

  async getById(customer: { sub: number }, id: number) {
    const item = customizationStore.get(id);
    if (!item || item.customerId !== customer.sub) {
      throw new NotFoundException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });
    }
    return item;
  }

  async createCustomRequest(_customer: { sub: number }, _body: Record<string, unknown>) {
    return { id: customizationIdSeq++, status: 'pending_review' as const };
  }
}
