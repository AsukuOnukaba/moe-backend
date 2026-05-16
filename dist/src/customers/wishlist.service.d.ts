import { PrismaService } from '../database/prisma.service';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
export declare class WishlistService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    addByProductId(user: AccessTokenPayload, productId: number): Promise<{
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
    }>;
    add(user: AccessTokenPayload, body: {
        productId?: number;
        id?: number;
    }): Promise<{
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
    }>;
    listFullProducts(user: AccessTokenPayload): Promise<{
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
        }[];
        total: number;
    }>;
    listAll(user: AccessTokenPayload): Promise<{
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
        }[];
        total: number;
    }>;
    remove(user: AccessTokenPayload, productId: number): Promise<void>;
}
