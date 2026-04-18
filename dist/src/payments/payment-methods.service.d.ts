import { PrismaService } from '../database/prisma.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { PaymentMethodDto } from './dto/payment-method.dto';
export declare class PaymentMethodsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(userId: number): Promise<{
        data: PaymentMethodDto[];
        total: number;
    }>;
    create(userId: number, dto: CreatePaymentMethodDto): Promise<PaymentMethodDto>;
    remove(id: string, userId: number): Promise<void>;
    setDefault(id: string, userId: number): Promise<PaymentMethodDto>;
    private toDto;
}
