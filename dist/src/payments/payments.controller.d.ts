import type { Request } from 'express';
import { PaymentsService } from './payments.service';
import { PaymentMethodsService } from './payment-methods.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
export declare class PaymentsController {
    private readonly payments;
    private readonly paymentMethods;
    constructor(payments: PaymentsService, paymentMethods: PaymentMethodsService);
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
    listPaymentMethods(req: Request): Promise<{
        data: import("./dto/payment-method.dto").PaymentMethodDto[];
        total: number;
    }>;
    createPaymentMethod(req: Request, dto: CreatePaymentMethodDto): Promise<import("./dto/payment-method.dto").PaymentMethodDto>;
    deletePaymentMethod(req: Request, id: string): Promise<void>;
    setDefaultPaymentMethod(req: Request, id: string): Promise<import("./dto/payment-method.dto").PaymentMethodDto>;
}
