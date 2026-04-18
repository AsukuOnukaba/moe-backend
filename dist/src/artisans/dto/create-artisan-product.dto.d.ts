export declare class CreateArtisanProductDto {
    name: string;
    description?: string | null;
    price: number;
    originalPrice?: number | null;
    currency?: string;
    images?: string[] | null;
    category?: string | null;
    materials?: string | null;
    tags?: string | null;
    featured?: boolean;
    isBestSeller?: boolean;
    isTrending?: boolean;
    isNewArrival?: boolean;
    discountPercent?: number | null;
    estimatedDeliveryDays?: number;
}
