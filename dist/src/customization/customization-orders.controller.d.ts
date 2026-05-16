import type { Request } from 'express';
import { CustomizationOrdersService } from './customization-orders.service';
export declare class CustomizationOrdersController {
    private readonly custom;
    constructor(custom: CustomizationOrdersService);
    create(req: Request, body: any): Promise<{
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
    } | {
        message: string;
        code: string;
    }>;
    get(req: Request, id: string): Promise<{
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
    }>;
    submitCustomRequest(req: Request, body: any): Promise<{
        id: number;
        status: "pending_review";
    }>;
}
