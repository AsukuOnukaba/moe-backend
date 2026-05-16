import { PrismaService } from '../database/prisma.service';
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
export declare class CustomizationOrdersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(customer: {
        sub: number;
    }, body: Record<string, unknown>): Promise<CustomizationOrder | {
        message: string;
        code: string;
    }>;
    getById(customer: {
        sub: number;
    }, id: number): Promise<CustomizationOrder>;
    createCustomRequest(_customer: {
        sub: number;
    }, _body: Record<string, unknown>): Promise<{
        id: number;
        status: "pending_review";
    }>;
}
export {};
