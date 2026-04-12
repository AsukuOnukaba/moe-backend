import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async createAddress(
    userId: number,
    data: {
      addressLine1: string;
      city: string;
      state: string;
      country: string;
      postalCode?: string;
    },
  ) {
    // Check if this is the first address, if so set it as default
    const existingCount = await this.prisma.address.count({
      where: { userId },
    });
    const isDefault = existingCount === 0;

    // If setting as default, unset other defaults
    if (isDefault) {
      await this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    const address = await this.prisma.address.create({
      data: {
        userId,
        ...data,
        isDefault,
      },
    });

    return address;
  }

  async getAddresses(userId: number) {
    return await this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async updateAddress(
    userId: number,
    addressId: number,
    data: {
      addressLine1?: string;
      city?: string;
      state?: string;
      country?: string;
      postalCode?: string;
    },
  ) {
    // Verify ownership
    const address = await this.prisma.address.findUnique({
      where: { id: addressId },
    });
    if (!address || address.userId !== userId) {
      throw new NotFoundException('Address not found');
    }

    const updated = await this.prisma.address.update({
      where: { id: addressId },
      data,
    });

    return updated;
  }

  async setDefaultAddress(userId: number, addressId: number) {
    // Verify ownership
    const address = await this.prisma.address.findUnique({
      where: { id: addressId },
    });
    if (!address || address.userId !== userId) {
      throw new NotFoundException('Address not found');
    }

    // Unset other defaults and set this one as default
    await this.prisma.address.updateMany({
      where: { userId, id: { not: addressId } },
      data: { isDefault: false },
    });

    const updated = await this.prisma.address.update({
      where: { id: addressId },
      data: { isDefault: true },
    });

    return updated;
  }

  async deleteAddress(userId: number, addressId: number) {
    // Verify ownership
    const address = await this.prisma.address.findUnique({
      where: { id: addressId },
    });
    if (!address || address.userId !== userId) {
      throw new NotFoundException('Address not found');
    }

    await this.prisma.address.delete({
      where: { id: addressId },
    });

    return { success: true };
  }
}
