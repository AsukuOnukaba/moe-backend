import { ProductsService } from './products.service';
export declare class ProductsController {
    private readonly products;
    constructor(products: ProductsService);
    list(query: any): Promise<{
        data: {
            id: any;
            name: any;
            description: any;
            priceRange: {
                min: any;
                max: any;
            };
            currency: any;
            estimatedDeliveryDays: any;
            materials: any;
            tags: string[];
            images: any[];
            category: any;
            providerId: any;
            featured: any;
            isBestSeller: any;
            isTrending: any;
            isNewArrival: any;
            discountPercent: any;
            originalPrice: any;
        }[];
        pagination: {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        };
    }>;
    recommendations(query: any): Promise<{
        data: {
            id: any;
            name: any;
            description: any;
            priceRange: {
                min: any;
                max: any;
            };
            currency: any;
            estimatedDeliveryDays: any;
            materials: any;
            tags: string[];
            images: any[];
            category: any;
            providerId: any;
            featured: any;
            isBestSeller: any;
            isTrending: any;
            isNewArrival: any;
            discountPercent: any;
            originalPrice: any;
        }[];
        pagination: {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        };
    }>;
    getById(id: string): Promise<{
        id: any;
        name: any;
        description: any;
        priceRange: {
            min: any;
            max: any;
        };
        currency: any;
        estimatedDeliveryDays: any;
        materials: any;
        tags: string[];
        images: any[];
        category: any;
        providerId: any;
        featured: any;
        isBestSeller: any;
        isTrending: any;
        isNewArrival: any;
        discountPercent: any;
        originalPrice: any;
    } | {
        message: string;
        code: string;
    }>;
    variants(id: string): Promise<never[]>;
}
