import type { Request } from 'express';
import { CartService } from './cart.service';
export declare class CartController {
    private readonly cart;
    constructor(cart: CartService);
    list(req: Request): Promise<{
        id: string;
        productId: number;
        productName: string;
        providerId: number | null;
        providerName: string;
        basePrice: number;
        finalPrice: number;
        category: string;
        selectedSize: string;
        selectedBodyType: string | null;
        selectedVariants: Record<string, unknown>;
        measurements: Record<string, unknown>;
        customisation: Record<string, unknown> | null;
        notes: string | null;
        quantity: number;
    }[]>;
    add(req: Request, body: any): Promise<{
        id: string;
        productId: number;
        productName: string;
        providerId: number | null;
        providerName: string;
        basePrice: number;
        finalPrice: number;
        category: string;
        selectedSize: string;
        selectedBodyType: string | null;
        selectedVariants: Record<string, unknown>;
        measurements: Record<string, unknown>;
        customisation: Record<string, unknown> | null;
        notes: string | null;
        quantity: number;
    }>;
    patch(req: Request, id: string, body: any): Promise<{
        id: string;
        productId: number;
        productName: string;
        providerId: number | null;
        providerName: string;
        basePrice: number;
        finalPrice: number;
        category: string;
        selectedSize: string;
        selectedBodyType: string | null;
        selectedVariants: Record<string, unknown>;
        measurements: Record<string, unknown>;
        customisation: Record<string, unknown> | null;
        notes: string | null;
        quantity: number;
    }>;
    remove(req: Request, id: string): Promise<{
        success: boolean;
    }>;
    clear(req: Request): Promise<{
        success: boolean;
    }>;
}
