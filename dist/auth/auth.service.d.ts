import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
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
    }): Promise<{
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
    login(input: {
        email: string;
        password: string;
    }): Promise<{
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
    refresh(refreshToken: string): Promise<{
        token: string;
        refreshToken: string;
    }>;
    logoutAll(userId: number): Promise<{
        success: boolean;
    }>;
    profile(userId: number): Promise<{
        id: number;
        username: string;
        name: string;
        email: string;
        phone: string | null;
        avatarUrl: string | null;
        preferences: null;
        createdAt: string;
    }>;
    private toCustomerProfile;
}
