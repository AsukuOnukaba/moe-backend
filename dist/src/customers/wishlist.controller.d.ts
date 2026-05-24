import type { Request } from 'express';
import { WishlistService } from './wishlist.service';
export declare class WishlistController {
    private readonly wishlist;
    constructor(wishlist: WishlistService);
    list(req: Request): Promise<{
        data: {
            id: number;
            name: string;
            description: string;
            priceRange: {
                min: number;
                max: number;
            };
            currency: string;
            estimatedDeliveryDays: number;
            materials: string;
            tags: string[];
            images: string[];
            category: string | null;
            providerId: number | null;
            featured: boolean;
            isBestSeller: boolean;
            isTrending: boolean;
            isNewArrival: boolean;
            discountPercent: number | null;
            originalPrice: number | null;
            status: string | null;
            customisationRequired: boolean;
            wishlistItemId: number;
            productId: number;
            addedAt: string;
            providerName: string | null;
            artisanName: string | null;
        }[];
        total: number;
    }>;
    add(req: Request, body: any): Promise<{
        id: number;
        name: string;
        description: string;
        priceRange: {
            min: number;
            max: number;
        };
        currency: string;
        estimatedDeliveryDays: number;
        materials: string;
        tags: string[];
        images: string[];
        category: string | null;
        providerId: number | null;
        featured: boolean;
        isBestSeller: boolean;
        isTrending: boolean;
        isNewArrival: boolean;
        discountPercent: number | null;
        originalPrice: number | null;
        status: string | null;
        customisationRequired: boolean;
        wishlistItemId: number;
        productId: number;
        addedAt: string;
        providerName: string | null;
        artisanName: string | null;
    }>;
    removeByItemId(req: Request, wishlistItemId: string): Promise<void>;
    remove(req: Request, productId: string): Promise<void>;
}
