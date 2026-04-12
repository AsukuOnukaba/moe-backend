import type { Request } from 'express';
import { CartService } from './cart.service';
export declare class CartController {
    private readonly cart;
    constructor(cart: CartService);
    list(req: Request): Promise<{
        id: string;
        productId: number;
        productName: string;
        providerId: number;
        providerName: string;
        basePrice: number;
        finalPrice: number;
        category: string;
        selectedSize: string;
        selectedBodyType: string | null;
        selectedVariants: {};
        measurements: {};
        notes: string | null;
        quantity: number;
    }[]>;
    add(req: Request, body: any): Promise<{
        id: string;
        productId: number;
        productName: string;
        providerId: number;
        providerName: string;
        basePrice: number;
        finalPrice: number;
        category: string;
        selectedSize: string;
        selectedBodyType: string | null;
        selectedVariants: {};
        measurements: {};
        notes: string | null;
        quantity: number;
    } | {
        message: string;
        code: string;
    }>;
    patch(req: Request, id: string, body: any): Promise<{
        id: string;
        productId: number;
        productName: string;
        providerId: number;
        providerName: string;
        basePrice: number;
        finalPrice: number;
        category: string;
        selectedSize: string;
        selectedBodyType: string | null;
        selectedVariants: {};
        measurements: {};
        notes: string | null;
        quantity: number;
    } | {
        message: string;
        code: string;
    }>;
    remove(req: Request, id: string): Promise<{
        message: string;
        code: string;
        success?: undefined;
    } | {
        success: boolean;
        message?: undefined;
        code?: undefined;
    }>;
    clear(req: Request): Promise<{
        success: boolean;
    }>;
}
