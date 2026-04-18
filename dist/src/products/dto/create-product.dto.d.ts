export declare class CreateProductDto {
    name: string;
    description: string;
    category: string;
    priceMin: number;
    priceMax: number;
    currency?: string;
    materials?: string;
    estimatedDeliveryDays?: number;
    images?: string[];
    tags?: string[];
}
