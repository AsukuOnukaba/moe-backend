import type { Request } from 'express';
import { UsersService } from '../users/users.service';
declare class CreateAddressDto {
    addressLine1: string;
    city: string;
    state: string;
    country: string;
    postalCode?: string;
}
declare class UpdateAddressDto {
    addressLine1?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
}
export declare class AddressesController {
    private readonly users;
    constructor(users: UsersService);
    getAddresses(req: Request): Promise<{
        data: {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            userId: number;
            country: string;
            city: string;
            state: string;
            addressLine1: string;
            postalCode: string | null;
            isDefault: boolean;
        }[];
        total: number;
    }>;
    createAddress(req: Request, dto: CreateAddressDto): Promise<{
        id: number;
        createdAt: Date;
        updatedAt: Date;
        userId: number;
        country: string;
        city: string;
        state: string;
        addressLine1: string;
        postalCode: string | null;
        isDefault: boolean;
    }>;
    updateAddress(req: Request, id: string, dto: UpdateAddressDto): Promise<{
        id: number;
        createdAt: Date;
        updatedAt: Date;
        userId: number;
        country: string;
        city: string;
        state: string;
        addressLine1: string;
        postalCode: string | null;
        isDefault: boolean;
    }>;
    setDefaultAddress(req: Request, id: string): Promise<{
        id: number;
        createdAt: Date;
        updatedAt: Date;
        userId: number;
        country: string;
        city: string;
        state: string;
        addressLine1: string;
        postalCode: string | null;
        isDefault: boolean;
    }>;
    deleteAddress(req: Request, id: string): Promise<void>;
}
export {};
