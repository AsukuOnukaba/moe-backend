import type { Request } from 'express';
import { OrdersService } from './orders.service';
export declare class OrdersController {
    private readonly orders;
    constructor(orders: OrdersService);
    list(req: Request, query: any): Promise<{
        data: {
            id: string;
            customerId: number;
            productId: number;
            productName: string;
            productImage: string;
            providerId: number | null;
            providerName: string;
            customizationId: number | null;
            isCustomOrder: boolean;
            status: "pending" | "awaiting_payment" | "in_progress" | "completed" | "cancelled";
            price: number;
            currency: string;
            shippingAddress: {
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
            paymentMethod: string;
            paymentReference: string | null;
            paymentStatus: "unpaid" | "paid" | "refunded";
            createdAt: string;
            updatedAt: string;
        }[];
        pagination: {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        };
    }>;
    get(req: Request, id: string): Promise<{
        id: string;
        customerId: number;
        productId: number;
        productName: string;
        productImage: string;
        providerId: number | null;
        providerName: string;
        customizationId: number | null;
        isCustomOrder: boolean;
        status: "pending" | "awaiting_payment" | "in_progress" | "completed" | "cancelled";
        price: number;
        currency: string;
        shippingAddress: {
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
        paymentMethod: string;
        paymentReference: string | null;
        paymentStatus: "unpaid" | "paid" | "refunded";
        createdAt: string;
        updatedAt: string;
    } | null>;
    create(req: Request, body: any): Promise<{
        id: string;
        customerId: number;
        productId: number;
        productName: string;
        productImage: string;
        providerId: number | null;
        providerName: string;
        customizationId: number | null;
        isCustomOrder: boolean;
        status: "pending" | "awaiting_payment" | "in_progress" | "completed" | "cancelled";
        price: number;
        currency: string;
        shippingAddress: {
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
        paymentMethod: string;
        paymentReference: string | null;
        paymentStatus: "unpaid" | "paid" | "refunded";
        createdAt: string;
        updatedAt: string;
    } | {
        message: string;
        code: string;
    }>;
    patch(req: Request, id: string, body: any): Promise<{
        id: string;
        customerId: number;
        productId: number;
        productName: string;
        productImage: string;
        providerId: number | null;
        providerName: string;
        customizationId: number | null;
        isCustomOrder: boolean;
        status: "pending" | "awaiting_payment" | "in_progress" | "completed" | "cancelled";
        price: number;
        currency: string;
        shippingAddress: {
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
        paymentMethod: string;
        paymentReference: string | null;
        paymentStatus: "unpaid" | "paid" | "refunded";
        createdAt: string;
        updatedAt: string;
    } | null>;
}
