import { PrismaService } from '../database/prisma.service';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
type WishlistItem = {
    id: number;
    customerId: number;
    productId: number;
    productName: string;
    providerId: number;
    providerName: string;
    priceMin: number;
    priceMax: number;
    currency: string;
    category: string | null;
    imageUrl: string | null;
    styleTags: string[];
    addedAt: string;
};
export declare class WishlistService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private list;
    add(user: AccessTokenPayload, body: any): Promise<WishlistItem | {
        message: string;
        code: string;
    }>;
    listAll(user: AccessTokenPayload): Promise<WishlistItem[]>;
    remove(user: AccessTokenPayload, productId: number): Promise<{
        message: string;
        code: string;
        success?: undefined;
    } | {
        success: boolean;
        message?: undefined;
        code?: undefined;
    }>;
}
export {};
