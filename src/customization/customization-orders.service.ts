import { Injectable, NotFoundException } from '@nestjs/common';

type CustomizationOrder = {
  id: number;
  productId: number;
  customerId: number;
  selectedVariants: Record<string, any>;
  selectedSize: string;
  selectedBodyType: string | null;
  selectedFootType: string | null;
  measurements: Record<string, any>;
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

type CustomRequest = {
  id: number;
  status: 'pending_review';
};

const customizationStore = new Map<number, CustomizationOrder>();
const customRequestStore = new Map<number, CustomRequest>();
let customizationIdSeq = 1;
let customRequestIdSeq = 1;

@Injectable()
export class CustomizationOrdersService {
  async create(customer: any, body: any) {
    const productId = Number(body?.productId ?? 0);
    if (!productId) return { message: 'Missing productId', code: 'VALIDATION_ERROR' };

    const now = new Date().toISOString();
    const customization: CustomizationOrder = {
      id: customizationIdSeq++,
      productId,
      customerId: customer.sub,
      selectedVariants: body?.selectedVariants ?? {},
      selectedSize: typeof body?.selectedSize === 'string' ? body.selectedSize : '',
      selectedBodyType: body?.selectedBodyType ?? null,
      selectedFootType: body?.selectedFootType ?? null,
      measurements: body?.measurements ?? {},
      notes: typeof body?.notes === 'string' ? body.notes : null,
      basePrice: Number(body?.basePrice ?? 0),
      variantModifierTotal: Number(body?.variantModifierTotal ?? 0),
      customizationFee: Number(body?.customizationFee ?? 0),
      finalPrice: Number(body?.finalPrice ?? 0),
      rushOrder: Boolean(body?.rushOrder ?? false),
      rushOrderCost: Number(body?.rushOrderCost ?? 0),
      estimatedDeliveryDays: Number(body?.estimatedDeliveryDays ?? 7),
      status: 'submitted',
      createdAt: now,
      updatedAt: now,
    };

    customizationStore.set(customization.id, customization);
    return customization;
  }

  async getById(customer: any, id: number) {
    const item = customizationStore.get(id);
    if (!item || item.customerId !== customer.sub) {
      throw new NotFoundException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });
    }
    return item;
  }

  async createCustomRequest(customer: any, body: any) {
    const now = new Date().toISOString();
    const req: CustomRequest = {
      id: customRequestIdSeq++,
      status: 'pending_review',
    };
    customRequestStore.set(req.id, req);
    // TEMP: store payload in memory not required by the spec response.
    void now;
    void body;
    return req;
  }
}

