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
    selectedVariants: Record<string, unknown>;
    measurements: Record<string, unknown>;
    customisation: Record<string, unknown> | null;
    notes: string | null;
    quantity: number;
};
export declare class CartService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private getCartForUser;
    list(user: AccessTokenPayload): Promise<CartItem[]>;
    add(user: AccessTokenPayload, body: Record<string, unknown>): Promise<CartItem>;
    patch(user: AccessTokenPayload, cartItemId: string, body: Record<string, unknown>): Promise<CartItem>;
    remove(user: AccessTokenPayload, cartItemId: string): Promise<{
        success: boolean;
    }>;
    clear(user: AccessTokenPayload): Promise<{
        success: boolean;
    }>;
}
export {};
