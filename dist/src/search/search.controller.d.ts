import { SearchService } from './search.service';
export declare class SearchController {
    private readonly search;
    constructor(search: SearchService);
    doSearch(query: any): Promise<{
        products: {
            id: number;
            name: string;
            description: string;
            priceRange: {
                min: number;
                max: number;
            };
            currency: string;
            estimatedDeliveryDays: number;
            materials: string;
            tags: string[];
            images: string[];
            category: string | null;
            providerId: number | null;
            featured: boolean;
            isBestSeller: boolean;
            isTrending: boolean;
            isNewArrival: boolean;
            discountPercent: number | null;
            originalPrice: number | null;
            status: string | null;
            customisationRequired: boolean;
        }[];
        providers: {
            id: any;
            brandName: any;
            firstName: any;
            lastName: any;
            about: any;
            city: any;
            state: any;
            phone: any;
            email: any;
            rating: any;
            reviewCount: any;
            verified: any;
            featured: any;
            estimatedDeliveryDays: any;
            heroImage: any;
            customOrdersEnabled: any;
            category: any;
            styleTags: string[];
            serviceCategories: string[];
        }[];
        categories: {
            id: string;
            name: string;
        }[];
    }>;
}
