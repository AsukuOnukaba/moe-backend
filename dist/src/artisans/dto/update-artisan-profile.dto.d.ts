export declare class UpdateArtisanProfileDto {
    brandName?: string;
    businessName?: string | null;
    description?: string | null;
    about?: string | null;
    country?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    category?: string | null;
    styleTags?: string | null;
    serviceCategories?: string | null;
    heroImage?: string | null;
    storeImageUrl?: string | null;
    coverImageUrl?: string | null;
    images?: string[] | null;
    customOrdersEnabled?: boolean;
    rushOrderEnabled?: boolean;
    rushOrderSurchargePercent?: number;
    verified?: boolean;
    featured?: boolean;
    estimatedDeliveryDays?: number;
    paymentSchedule?: string | null;
    depositPercentage?: number | null;
    refundPolicy?: string | null;
    acceptedPaymentMethods?: string[];
    installmentsAvailable?: boolean;
    installmentDetails?: string | null;
}
