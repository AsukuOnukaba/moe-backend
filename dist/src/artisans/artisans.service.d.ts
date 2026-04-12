import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { UpdateArtisanProfileDto } from './dto/update-artisan-profile.dto';
import { CreateArtisanProductDto } from './dto/create-artisan-product.dto';
import { UpdateArtisanProductDto } from './dto/update-artisan-product.dto';
export declare class ArtisansService {
    private readonly prisma;
    private readonly config;
    constructor(prisma: PrismaService, config: ConfigService);
    private requireArtisan;
    getMe(user: AccessTokenPayload): Promise<{
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
    patchMe(user: AccessTokenPayload, dto: UpdateArtisanProfileDto): Promise<{
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
    listProducts(user: AccessTokenPayload, page: number, pageSize: number): Promise<{
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
    createProduct(user: AccessTokenPayload, dto: CreateArtisanProductDto): Promise<{
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
    patchProduct(user: AccessTokenPayload, productId: number, dto: UpdateArtisanProductDto): Promise<{
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
    deleteProduct(user: AccessTokenPayload, productId: number): Promise<{
        success: boolean;
    }>;
    private toProductDto;
}
