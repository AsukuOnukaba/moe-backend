import { PrismaService } from '../database/prisma.service';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
export interface WishlistItemResponse {
    id: number;
    productId: number;
    productName: string;
    providerId: number | null;
    providerName: string;
    price: number | null;
    currency: string;
    category: string | null;
    imageUrl: string | null;
    styleTags: string[];
    addedAt: Date;
}
export declare class WishlistService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    add(user: AccessTokenPayload, body: any): Promise<WishlistItemResponse>;
    listAll(user: AccessTokenPayload): Promise<{
        data: WishlistItemResponse[];
        total: number;
    }>;
    remove(user: AccessTokenPayload, productId: number): Promise<null>;
    private formatWishlistItem;
}
