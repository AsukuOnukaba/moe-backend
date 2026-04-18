import type { Request } from 'express';
import { WishlistService } from './wishlist.service';
export declare class WishlistController {
    private readonly wishlist;
    constructor(wishlist: WishlistService);
    list(req: Request): Promise<{
        data: import("./wishlist.service").WishlistItemResponse[];
        total: number;
    }>;
    add(req: Request, body: any): Promise<import("./wishlist.service").WishlistItemResponse>;
    remove(req: Request, productId: string): Promise<void>;
}
