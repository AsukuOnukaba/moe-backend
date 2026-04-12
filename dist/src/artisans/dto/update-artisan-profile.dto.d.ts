export declare class UpdateArtisanProfileDto {
    brandName?: string;
    about?: string | null;
    city?: string | null;
    state?: string | null;
    category?: string | null;
    styleTags?: string | null;
    serviceCategories?: string | null;
    heroImage?: string | null;
    customOrdersEnabled?: boolean;
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
