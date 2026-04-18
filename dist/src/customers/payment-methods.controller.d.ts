import type { Request } from 'express';
import { PaymentMethodsService } from '../payments/payment-methods.service';
import { CreatePaymentMethodDto } from '../payments/dto/create-payment-method.dto';
export declare class PaymentMethodsController {
    private readonly paymentMethods;
    constructor(paymentMethods: PaymentMethodsService);
    listPaymentMethods(req: Request): Promise<{
        data: import("../payments/dto/payment-method.dto").PaymentMethodDto[];
        total: number;
    }>;
    createPaymentMethod(req: Request, dto: CreatePaymentMethodDto): Promise<import("../payments/dto/payment-method.dto").PaymentMethodDto>;
    deletePaymentMethod(req: Request, id: string): Promise<void>;
    setDefaultPaymentMethod(req: Request, id: string): Promise<import("../payments/dto/payment-method.dto").PaymentMethodDto>;
}
