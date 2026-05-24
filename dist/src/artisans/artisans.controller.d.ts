import type { Request } from 'express';
import { ArtisansService } from './artisans.service';
import { UpdateArtisanProfileDto } from './dto/update-artisan-profile.dto';
import { CreateArtisanProductDto } from './dto/create-artisan-product.dto';
import { UpdateArtisanProductDto } from './dto/update-artisan-product.dto';
export declare class ArtisansController {
    private readonly artisans;
    constructor(artisans: ArtisansService);
    filterMeta(): Promise<{
        categories: string[];
        serviceCategories: string[];
        locations: string[];
    }>;
    rushOrderConfig(id: string): Promise<{
        rushOrderEnabled: boolean;
        surchargePercent: number;
    }>;
    getAll(page?: string, pageSize?: string, category?: string): Promise<{
        data: {
            id: number;
            name: string;
            brandName: string;
            businessName: string | null;
            description: string | null;
            location: string | null;
            category: string | null;
            images: string[];
            heroImage: string | null;
            rating: number;
            reviewCount: number;
            verified: boolean;
            featured: boolean;
        }[];
        pagination: {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        };
    }>;
    getMe(req: Request): Promise<{
        id: number;
        providerId: number;
        brandName: string;
        businessName: string | null;
        firstName: string | null;
        lastName: string | null;
        about: string | null;
        description: string | null;
        city: string | null;
        state: string | null;
        country: string | null;
        address: string | null;
        phone: string | null;
        email: string;
        rating: number;
        reviewCount: number;
        verified: boolean;
        featured: boolean;
        estimatedDeliveryDays: number;
        heroImage: string | null;
        storeImageUrl: string | null;
        coverImageUrl: string | null;
        customOrdersEnabled: boolean;
        rushOrderEnabled: boolean;
        rushOrderSurchargePercent: number;
        status: string;
        category: string | null;
        styleTags: string[];
        serviceCategories: string[];
    }>;
    patchMe(req: Request, dto: UpdateArtisanProfileDto): Promise<{
        id: number;
        brandName: string;
        firstName: string | null;
        lastName: string | null;
        about: string | null;
        city: string | null;
        state: string | null;
        phone: string | null;
        email: string;
        rating: number;
        reviewCount: number;
        verified: boolean;
        featured: boolean;
        estimatedDeliveryDays: number;
        heroImage: string | null;
        storeImageUrl: string | null;
        coverImageUrl: string | null;
        customOrdersEnabled: boolean;
        rushOrderEnabled: boolean;
        rushOrderSurchargePercent: number;
        status: string;
        category: string | null;
        styleTags: string[];
        serviceCategories: string[];
    }>;
    listProducts(req: Request, page?: string, pageSize?: string): Promise<{
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
    createProduct(req: Request, dto: CreateArtisanProductDto): Promise<{
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
    uploadProductImage(file: Express.Multer.File, req: Request): Promise<{
        url: string;
    }>;
    uploadStoreImage(file: Express.Multer.File, req: Request): Promise<{
        url: string;
    }>;
    uploadCoverImage(file: Express.Multer.File, req: Request): Promise<{
        url: string;
    }>;
    patchProduct(req: Request, id: string, dto: UpdateArtisanProductDto): Promise<{
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
    deleteProduct(req: Request, id: string): Promise<{
        success: boolean;
    }>;
}
