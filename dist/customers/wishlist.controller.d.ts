import type { Request } from 'express';
import { WishlistService } from './wishlist.service';
export declare class WishlistController {
    private readonly wishlist;
    constructor(wishlist: WishlistService);
    list(req: Request): Promise<{
        id: number;
        customerId: number;
        productId: number;
        productName: string;
        providerId: number;
        providerName: string;
        priceMin: number;
        priceMax: number;
        currency: string;
        category: string | null;
        imageUrl: string | null;
        styleTags: string[];
        addedAt: string;
    }[]>;
    add(req: Request, body: any): Promise<{
        id: number;
        customerId: number;
        productId: number;
        productName: string;
        providerId: number;
        providerName: string;
        priceMin: number;
        priceMax: number;
        currency: string;
        category: string | null;
        imageUrl: string | null;
        styleTags: string[];
        addedAt: string;
    } | {
        message: string;
        code: string;
    }>;
    remove(req: Request, productId: string): Promise<{
        message: string;
        code: string;
        success?: undefined;
    } | {
        success: boolean;
        message?: undefined;
        code?: undefined;
    }>;
}
