import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { OrdersService } from '../orders/orders.service';
export declare class PaymentsService {
    private readonly orders;
    constructor(orders: OrdersService);
    initialize(user: AccessTokenPayload, body: any): Promise<{
        message: string;
        code: string;
    } | {
        txRef?: string | undefined;
        accessCode?: string | undefined;
        paymentUrl: string;
        reference: string;
        message?: undefined;
        code?: undefined;
    }>;
    verify(user: AccessTokenPayload, body: any): Promise<{
        message: string;
        code: string;
        reference?: undefined;
        status?: undefined;
        amount?: undefined;
        currency?: undefined;
        paidAt?: undefined;
        orderId?: undefined;
    } | {
        reference: any;
        status: string;
        amount: number;
        currency: string;
        paidAt: null;
        orderId: string;
        message?: undefined;
        code?: undefined;
    } | {
        reference: string;
        status: "success";
        amount: number;
        currency: string;
        paidAt: string;
        orderId: string;
        message?: undefined;
        code?: undefined;
    }>;
}
