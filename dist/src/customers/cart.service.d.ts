import { PrismaService } from '../database/prisma.service';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
type CartItem = {
    id: string;
    productId: number;
    productName: string;
    providerId: number | null;
    providerName: string;
    basePrice: number;
    finalPrice: number;
    category: string;
    selectedSize: string;
    selectedBodyType: string | null;
    selectedVariants: {};
    measurements: {};
    notes: string | null;
    quantity: number;
};
export declare class CartService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private getCartForUser;
    list(user: AccessTokenPayload): Promise<CartItem[]>;
    add(user: AccessTokenPayload, body: any): Promise<CartItem | {
        message: string;
        code: string;
    }>;
    patch(user: AccessTokenPayload, cartItemId: string, body: any): Promise<CartItem | {
        message: string;
        code: string;
    }>;
    remove(user: AccessTokenPayload, cartItemId: string): Promise<{
        message: string;
        code: string;
        success?: undefined;
    } | {
        success: boolean;
        message?: undefined;
        code?: undefined;
    }>;
    clear(user: AccessTokenPayload): Promise<{
        success: boolean;
    }>;
}
export {};
