import type { Request } from 'express';
import { PaymentsService } from './payments.service';
export declare class PaymentsController {
    private readonly payments;
    constructor(payments: PaymentsService);
    initialize(req: Request, body: any): Promise<{
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
    verify(req: Request, body: any): Promise<{
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
