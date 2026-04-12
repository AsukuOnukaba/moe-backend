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
        pagination: Pagination;
    }>;
    private getSort;
    getProductById(id: number): Promise<{
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
    } | null>;
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
    variants(_productId: number): Promise<never[]>;
    listProductsByProvider(providerId: number, query: any): Promise<{
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
}
export {};
