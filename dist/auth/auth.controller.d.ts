import type { Request } from 'express';
import { AuthService } from './auth.service';
import { AuthLoginDto } from './dto/auth-login.dto';
import { AuthRegisterDto } from './dto/auth-register.dto';
import { AuthRefreshDto } from './dto/auth-refresh.dto';
export declare class AuthController {
    private readonly auth;
    constructor(auth: AuthService);
    register(dto: AuthRegisterDto): Promise<{
        user: {
            id: number;
            username: string;
            name: string;
            email: string;
            phone: string | null;
            avatarUrl: string | null;
            preferences: null;
            createdAt: string;
        };
        token: string;
        refreshToken: string;
    }>;
    login(dto: AuthLoginDto): Promise<{
        user: {
            id: number;
            username: string;
            name: string;
            email: string;
            phone: string | null;
            avatarUrl: string | null;
            preferences: null;
            createdAt: string;
        };
        token: string;
        refreshToken: string;
    }>;
    refresh(dto: AuthRefreshDto): Promise<{
        token: string;
        refreshToken: string;
    }>;
    profile(req: Request): Promise<{
        id: number;
        username: string;
        name: string;
        email: string;
        phone: string | null;
        avatarUrl: string | null;
        preferences: null;
        createdAt: string;
    }>;
    logout(req: Request): Promise<{
        success: boolean;
    }>;
}
