import type { Request } from 'express';
import { ServiceProvidersService } from './service-providers.service';
type Review = {
    id: number;
    providerId: number;
    customerId: number;
    orderId: string | null;
    rating: number;
    comment: string;
    createdAt: string;
};
export declare class ServiceProvidersController {
    private readonly providers;
    constructor(providers: ServiceProvidersService);
    listPublicInfo(query: any): Promise<{
        data: {
            id: any;
            brandName: any;
            firstName: any;
            lastName: any;
            about: any;
            city: any;
            state: any;
            phone: any;
            email: any;
            rating: any;
            reviewCount: any;
            verified: any;
            featured: any;
            estimatedDeliveryDays: any;
            heroImage: any;
            customOrdersEnabled: any;
            category: any;
            styleTags: string[];
            serviceCategories: string[];
        }[];
        pagination: {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        };
    }>;
    getPublicInfo(id: string): Promise<{
        id: any;
        brandName: any;
        firstName: any;
        lastName: any;
        about: any;
        city: any;
        state: any;
        phone: any;
        email: any;
        rating: any;
        reviewCount: any;
        verified: any;
        featured: any;
        estimatedDeliveryDays: any;
        heroImage: any;
        customOrdersEnabled: any;
        category: any;
        styleTags: string[];
        serviceCategories: string[];
    }>;
    productsByProvider(id: string, query: any): Promise<{
        data: {
            id: number;
            name: string;
            description: string;
            priceRange: {
                min: number | null;
                max: number | null;
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
        }[];
        pagination: {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        };
    }>;
    recommendations(): Promise<{
        data: {
            id: any;
            brandName: any;
            firstName: any;
            lastName: any;
            about: any;
            city: any;
            state: any;
            phone: any;
            email: any;
            rating: any;
            reviewCount: any;
            verified: any;
            featured: any;
            estimatedDeliveryDays: any;
            heroImage: any;
            customOrdersEnabled: any;
            category: any;
            styleTags: string[];
            serviceCategories: string[];
        }[];
        pagination: {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        };
    }>;
    listReviews(id: string, query: any): {
        data: Review[];
        pagination: {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        };
    };
    createReview(id: string, req: Request, body: any): Promise<Review | {
        message: string;
        code: string;
    }>;
}
export {};
