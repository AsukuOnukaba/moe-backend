import type { Request } from 'express';
import { ArtisansService } from './artisans.service';
import { UpdateArtisanProfileDto } from './dto/update-artisan-profile.dto';
import { CreateArtisanProductDto } from './dto/create-artisan-product.dto';
import { UpdateArtisanProductDto } from './dto/update-artisan-product.dto';
export declare class ArtisansController {
    private readonly artisans;
    constructor(artisans: ArtisansService);
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
        customOrdersEnabled: boolean;
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
        customOrdersEnabled: boolean;
        category: string | null;
        styleTags: string[];
        serviceCategories: string[];
    }>;
    listProducts(req: Request, page?: string, pageSize?: string): Promise<{
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
    createProduct(req: Request, dto: CreateArtisanProductDto): Promise<{
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
    }>;
    uploadProductImage(req: Request, file: Express.Multer.File): Promise<{
        imageUrl: string;
    }>;
    uploadProfileImage(req: Request, file: Express.Multer.File): Promise<{
        url: string;
    }>;
    patchProduct(req: Request, id: string, dto: UpdateArtisanProductDto): Promise<{
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
    }>;
    deleteProduct(req: Request, id: string): Promise<{
        success: boolean;
    }>;
}
