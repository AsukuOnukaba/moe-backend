import { PrismaService } from '../database/prisma.service';
export declare class UsersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    createAddress(userId: number, data: {
        addressLine1: string;
        city: string;
        state: string;
        country: string;
        postalCode?: string;
    }): Promise<{
        id: number;
        createdAt: Date;
        updatedAt: Date;
        userId: number;
        city: string;
        state: string;
        addressLine1: string;
        country: string;
        postalCode: string | null;
        isDefault: boolean;
    }>;
    getAddresses(userId: number): Promise<{
        id: number;
        createdAt: Date;
        updatedAt: Date;
        userId: number;
        city: string;
        state: string;
        addressLine1: string;
        country: string;
        postalCode: string | null;
        isDefault: boolean;
    }[]>;
    updateAddress(userId: number, addressId: number, data: {
        addressLine1?: string;
        city?: string;
        state?: string;
        country?: string;
        postalCode?: string;
    }): Promise<{
        id: number;
        createdAt: Date;
        updatedAt: Date;
        userId: number;
        city: string;
        state: string;
        addressLine1: string;
        country: string;
        postalCode: string | null;
        isDefault: boolean;
    }>;
    setDefaultAddress(userId: number, addressId: number): Promise<{
        id: number;
        createdAt: Date;
        updatedAt: Date;
        userId: number;
        city: string;
        state: string;
        addressLine1: string;
        country: string;
        postalCode: string | null;
        isDefault: boolean;
    }>;
    deleteAddress(userId: number, addressId: number): Promise<{
        success: boolean;
    }>;
}
