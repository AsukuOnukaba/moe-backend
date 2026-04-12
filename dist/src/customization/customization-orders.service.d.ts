type CustomizationOrder = {
    id: number;
    productId: number;
    customerId: number;
    selectedVariants: Record<string, any>;
    selectedSize: string;
    selectedBodyType: string | null;
    selectedFootType: string | null;
    measurements: Record<string, any>;
    notes: string | null;
    basePrice: number;
    variantModifierTotal: number;
    customizationFee: number;
    finalPrice: number;
    rushOrder: boolean;
    rushOrderCost: number;
    estimatedDeliveryDays: number;
    status: string;
    createdAt: string;
    updatedAt: string;
};
type CustomRequest = {
    id: number;
    status: 'pending_review';
};
export declare class CustomizationOrdersService {
    create(customer: any, body: any): Promise<CustomizationOrder | {
        message: string;
        code: string;
    }>;
    getById(customer: any, id: number): Promise<CustomizationOrder>;
    createCustomRequest(customer: any, body: any): Promise<CustomRequest>;
}
export {};
