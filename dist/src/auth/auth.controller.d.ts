import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthLoginDto } from './dto/auth-login.dto';
import { AuthRegisterDto } from './dto/auth-register.dto';
import { AuthRefreshDto } from './dto/auth-refresh.dto';
import { AuthProfilePatchDto } from './dto/auth-profile-patch.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ConfigService } from '@nestjs/config';
export declare class AuthController {
    private readonly auth;
    private readonly config;
    constructor(auth: AuthService, config: ConfigService);
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
    googleAuth(): void;
    googleCallback(req: Request, res: Response): Promise<void>;
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
    uploadAvatar(file: Express.Multer.File, req: Request): Promise<{
        url: string;
    }>;
    logout(req: Request): Promise<{
        success: boolean;
    }>;
    updateProfile(req: Request, dto: UpdateUserProfileDto): Promise<any>;
    changePassword(req: Request, dto: ChangePasswordDto): Promise<{
        message: string;
    }>;
    changePasswordLegacy(req: Request, dto: ChangePasswordDto): Promise<{
        message: string;
    }>;
}
