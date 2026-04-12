import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import type { MoeRole } from './types/jwt-payload';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
export declare class AuthService {
    private readonly prisma;
    private readonly jwt;
    private readonly config;
    constructor(prisma: PrismaService, jwt: JwtService, config: ConfigService);
    private accessExpiresIn;
    private refreshExpiresIn;
    private accessSecret;
    private refreshSecret;
    private ensureRoleExists;
    private ensureUserRole;
    private issueTokens;
    private resolvePrimaryRole;
    register(input: {
        name: string;
        email: string;
        password: string;
        phone?: string;
        role?: 'customer' | 'artisan';
    }): Promise<{
        user: {
            preferences: null;
            createdAt: string;
            artisanProfile?: {
                brandName: string;
                about: string | null;
                city: string | null;
                state: string | null;
                category: string | null;
                styleTags: string[];
                serviceCategories: string[];
                heroImage: string | null;
                verified: boolean;
                featured: boolean;
                estimatedDeliveryDays: number;
                customOrdersEnabled: boolean;
                rating: number;
                reviewCount: number;
            } | undefined;
            id: number;
            username: string;
            name: string;
            email: string;
            phone: string | null;
            avatarUrl: string | null;
            role: MoeRole;
        };
        token: string;
        refreshToken: string;
    }>;
    login(input: {
        email: string;
        password: string;
    }): Promise<{
        user: {
            preferences: null;
            createdAt: string;
            artisanProfile?: {
                brandName: string;
                about: string | null;
                city: string | null;
                state: string | null;
                category: string | null;
                styleTags: string[];
                serviceCategories: string[];
                heroImage: string | null;
                verified: boolean;
                featured: boolean;
                estimatedDeliveryDays: number;
                customOrdersEnabled: boolean;
                rating: number;
                reviewCount: number;
            } | undefined;
            id: number;
            username: string;
            name: string;
            email: string;
            phone: string | null;
            avatarUrl: string | null;
            role: MoeRole;
        };
        token: string;
        refreshToken: string;
    }>;
    refresh(refreshToken: string): Promise<{
        token: string;
        refreshToken: string;
    }>;
    logoutAll(userId: number): Promise<{
        success: boolean;
    }>;
    profile(userId: number): Promise<{
        preferences: null;
        createdAt: string;
        artisanProfile?: {
            brandName: string;
            about: string | null;
            city: string | null;
            state: string | null;
            category: string | null;
            styleTags: string[];
            serviceCategories: string[];
            heroImage: string | null;
            verified: boolean;
            featured: boolean;
            estimatedDeliveryDays: number;
            customOrdersEnabled: boolean;
            rating: number;
            reviewCount: number;
        } | undefined;
        id: number;
        username: string;
        name: string;
        email: string;
        phone: string | null;
        avatarUrl: string | null;
        role: MoeRole;
    }>;
    patchProfile(userId: number, input: {
        name?: string;
        phone?: string | null;
        artisanProfile?: {
            brandName?: string;
            about?: string | null;
            city?: string | null;
            state?: string | null;
            category?: string | null;
            styleTags?: string | string[] | null;
            serviceCategories?: string | string[] | null;
        };
    }): Promise<{
        preferences: null;
        createdAt: string;
        artisanProfile?: {
            brandName: string;
            about: string | null;
            city: string | null;
            state: string | null;
            category: string | null;
            styleTags: string[];
            serviceCategories: string[];
            heroImage: string | null;
            verified: boolean;
            featured: boolean;
            estimatedDeliveryDays: number;
            customOrdersEnabled: boolean;
            rating: number;
            reviewCount: number;
        } | undefined;
        id: number;
        username: string;
        name: string;
        email: string;
        phone: string | null;
        avatarUrl: string | null;
        role: MoeRole;
    }>;
    setAvatar(userId: number, avatarUrl: string): Promise<{
        preferences: null;
        createdAt: string;
        artisanProfile?: {
            brandName: string;
            about: string | null;
            city: string | null;
            state: string | null;
            category: string | null;
            styleTags: string[];
            serviceCategories: string[];
            heroImage: string | null;
            verified: boolean;
            featured: boolean;
            estimatedDeliveryDays: number;
            customOrdersEnabled: boolean;
            rating: number;
            reviewCount: number;
        } | undefined;
        id: number;
        username: string;
        name: string;
        email: string;
        phone: string | null;
        avatarUrl: string | null;
        role: MoeRole;
    }>;
    private toProfile;
    updateProfile(userId: number, dto: UpdateUserProfileDto): Promise<any>;
    changePassword(userId: number, dto: ChangePasswordDto): Promise<{
        message: string;
    }>;
}
