import { SearchService } from './search.service';
export declare class SearchController {
    private readonly search;
    constructor(search: SearchService);
    doSearch(query: any): Promise<{
        products: {
            id: any;
            name: any;
            description: any;
            priceRange: {
                min: any;
                max: any;
            };
            currency: any;
            estimatedDeliveryDays: any;
            materials: any;
            tags: string[];
            images: any[];
            category: any;
            providerId: any;
            featured: any;
            isBestSeller: any;
            isTrending: any;
            isNewArrival: any;
            discountPercent: any;
            originalPrice: any;
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
