import { PrismaService } from '../database/prisma.service';
type Pagination = {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
};
export declare class ProductsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    listProducts(query: any): Promise<{
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
        pagination: Pagination;
    }>;
    private getSort;
    getProductById(id: number): Promise<{
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
    } | null>;
    getCustomisationTemplate(category: string): Promise<{
        category: string;
        fields: import("./product-customisation.templates").CustomisationField[];
    }>;
    getFilterMeta(): Promise<{
        categories: string[];
        styleTags: string[];
        priceRange: {
            min: number;
            max: number;
        };
        deliveryDays: number[];
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
    variants(_productId: number): Promise<never[]>;
    listProductsByProvider(providerId: number, query: any): Promise<{
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
}
export {};
