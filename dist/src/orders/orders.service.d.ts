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
    id: number;
    customerId: number;
    productId: number;
    productName: string | null;
    productImage: string | null;
    providerId: number | null;
    providerName: string | null;
    customizationId: number | null;
    isCustomOrder: boolean;
    status: string;
    price: number | null;
    basePrice: number | null;
    rushSurcharge: number | null;
    rushOrder: boolean;
    customisationData: Record<string, unknown> | null;
    currency: string;
    shippingAddress: ShippingAddress;
    paymentMethod: string;
    paymentReference: string | null;
    paymentStatus: string;
    createdAt: string;
    updatedAt: string;
};
export declare class OrdersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private toOrderResponse;
    list(user: AccessTokenPayload, query: Record<string, unknown>): Promise<{
        data: Order[];
        total: number;
    }>;
    getById(user: AccessTokenPayload, orderId: string): Promise<Order | null>;
    create(user: AccessTokenPayload, body: Record<string, unknown>): Promise<Order | {
        message: string;
        code: string;
    }>;
    patch(user: AccessTokenPayload, orderId: string, body: Record<string, unknown>): Promise<Order | null>;
}
export {};
