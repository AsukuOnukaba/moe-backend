export declare class AuthRegisterDto {
    name: string;
    email: string;
    password: string;
    phone?: string;
    role?: 'customer' | 'artisan';
    serviceCategories?: string[];
}
