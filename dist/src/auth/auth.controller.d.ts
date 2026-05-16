import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthLoginDto } from './dto/auth-login.dto';
import { AuthRegisterDto } from './dto/auth-register.dto';
import { AuthRefreshDto } from './dto/auth-refresh.dto';
import { AuthProfilePatchDto } from './dto/auth-profile-patch.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { AdminVerifyOtpDto } from './dto/admin-verify-otp.dto';
import { CloudinaryService } from '../common/storage/cloudinary.service';
import { ConfigService } from '@nestjs/config';
export declare class AuthController {
    private readonly auth;
    private readonly cloudinary;
    private readonly config;
    constructor(auth: AuthService, cloudinary: CloudinaryService, config: ConfigService);
    register(dto: AuthRegisterDto): Promise<{
        message: string;
        email: string;
        requiresEmailVerification: boolean;
    }>;
    login(dto: AuthLoginDto): Promise<{
        requiresOtp: boolean;
        email: string;
    } | {
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
        requiresOtp?: undefined;
        email?: undefined;
    }>;
    verifyEmail(dto: VerifyEmailDto): Promise<{
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
    resendOtp(dto: ResendOtpDto): Promise<{
        message: string;
    }>;
    verifyAdminOtp(dto: AdminVerifyOtpDto): Promise<{
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
    uploadAvatar(req: Request, file: Express.Multer.File): Promise<{
        url: string;
    }>;
    logout(req: Request): Promise<{
        success: boolean;
    }>;
    updateProfile(req: Request, dto: UpdateUserProfileDto): Promise<any>;
    changePassword(req: Request, dto: ChangePasswordDto): Promise<{
        message: string;
    }>;
}
