import type { Request } from 'express';
import { AuthService } from './auth.service';
import { AuthLoginDto } from './dto/auth-login.dto';
import { AuthRegisterDto } from './dto/auth-register.dto';
import { AuthRefreshDto } from './dto/auth-refresh.dto';
import { AuthProfilePatchDto } from './dto/auth-profile-patch.dto';
export declare class AuthController {
    private readonly auth;
    constructor(auth: AuthService);
    register(dto: AuthRegisterDto): Promise<{
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
            role: import("./types/jwt-payload").MoeRole;
        };
        token: string;
        refreshToken: string;
    }>;
    login(dto: AuthLoginDto): Promise<{
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
            role: import("./types/jwt-payload").MoeRole;
        };
        token: string;
        refreshToken: string;
    }>;
    refresh(dto: AuthRefreshDto): Promise<{
        token: string;
        refreshToken: string;
    }>;
    profile(req: Request): Promise<{
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
        role: import("./types/jwt-payload").MoeRole;
    }>;
    patchProfile(req: Request, dto: AuthProfilePatchDto): Promise<{
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
        role: import("./types/jwt-payload").MoeRole;
    }>;
    uploadAvatar(req: Request, file: Express.Multer.File): Promise<{
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
        role: import("./types/jwt-payload").MoeRole;
    }>;
    logout(req: Request): Promise<{
        success: boolean;
    }>;
}
