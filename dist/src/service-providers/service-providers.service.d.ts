import { PrismaService } from '../database/prisma.service';
export declare class ServiceProvidersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    listPublicInfo(query: any): Promise<{
        data: {
            id: any;
            providerId: any;
            brandName: any;
            businessName: any;
            firstName: any;
            lastName: any;
            about: any;
            description: any;
            city: any;
            state: any;
            country: any;
            address: any;
            phone: any;
            email: any;
            rating: any;
            reviewCount: any;
            verified: any;
            featured: any;
            estimatedDeliveryDays: any;
            heroImage: any;
            storeImageUrl: any;
            coverImageUrl: any;
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
    getProviderPublicInfo(id: number): Promise<{
        id: any;
        providerId: any;
        brandName: any;
        businessName: any;
        firstName: any;
        lastName: any;
        about: any;
        description: any;
        city: any;
        state: any;
        country: any;
        address: any;
        phone: any;
        email: any;
        rating: any;
        reviewCount: any;
        verified: any;
        featured: any;
        estimatedDeliveryDays: any;
        heroImage: any;
        storeImageUrl: any;
        coverImageUrl: any;
        customOrdersEnabled: any;
        category: any;
        styleTags: string[];
        serviceCategories: string[];
    }>;
    listProductsByProvider(providerId: number, query: any): Promise<{
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
            providerId: any;
            brandName: any;
            businessName: any;
            firstName: any;
            lastName: any;
            about: any;
            description: any;
            city: any;
            state: any;
            country: any;
            address: any;
            phone: any;
            email: any;
            rating: any;
            reviewCount: any;
            verified: any;
            featured: any;
            estimatedDeliveryDays: any;
            heroImage: any;
            storeImageUrl: any;
            coverImageUrl: any;
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
    private userToProvider;
}
