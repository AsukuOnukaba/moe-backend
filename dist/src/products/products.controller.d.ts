import { ProductsService } from './products.service';
export declare class ProductsController {
    private readonly products;
    constructor(products: ProductsService);
    customisationTemplate(category: string): Promise<{
        category: string;
        fields: import("./product-customisation.templates").CustomisationField[];
    }>;
    filterMeta(): Promise<{
        categories: string[];
        styleTags: string[];
        priceRange: {
            min: number;
            max: number;
        };
        deliveryDays: number[];
    }>;
    list(query: any): Promise<{
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
        pagination: {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        };
    }>;
    recommendations(query: any): Promise<{
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
        pagination: {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        };
    }>;
    getById(id: string): Promise<{
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
    } | {
        message: string;
        code: string;
    }>;
    variants(id: string): Promise<never[]>;
}
