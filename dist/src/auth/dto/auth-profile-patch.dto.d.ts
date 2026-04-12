declare class ArtisanProfilePatchDto {
    brandName?: string;
    about?: string | null;
    city?: string | null;
    state?: string | null;
    category?: string | null;
    styleTags?: string[];
    serviceCategories?: string[];
}
export declare class AuthProfilePatchDto {
    name?: string;
    phone?: string | null;
    artisanProfile?: ArtisanProfilePatchDto;
}
export {};
