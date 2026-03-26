import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { PrismaService } from '../database/prisma.service';
type ShippingAddress = {
    firstName: string;
    lastName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string | null;
    city: string;
    state: string;
    country: string;
    postalCode?: string | null;
};
type Order = {
    id: string;
    customerId: number;
    productId: number;
    productName: string;
    productImage: string;
    providerId: number;
    providerName: string;
    customizationId: number | null;
    isCustomOrder: boolean;
    status: 'pending' | 'awaiting_payment' | 'in_progress' | 'completed' | 'cancelled';
    price: number;
    currency: string;
    shippingAddress: ShippingAddress;
    paymentMethod: string;
    paymentReference: string | null;
    paymentStatus: 'unpaid' | 'paid' | 'refunded';
    createdAt: string;
    updatedAt: string;
};
export declare class OrdersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private getOrdersForUser;
    list(user: AccessTokenPayload, query: any): Promise<{
        data: Order[];
        pagination: {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        };
    }>;
    getById(user: AccessTokenPayload, orderId: string): Promise<Order | null>;
    create(user: AccessTokenPayload, body: any): Promise<Order | {
        message: string;
        code: string;
    }>;
    patch(user: AccessTokenPayload, orderId: string, body: any): Promise<Order | null>;
}
export {};
