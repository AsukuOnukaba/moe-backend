import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { productToDto } from '../common/product-mapper';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const [
      totalUsers,
      artisansPending,
      artisansApproved,
      artisansRejected,
      productsPending,
      productsApproved,
      productsRejected,
      totalOrders,
      revenue,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.artisanProfile.count({ where: { status: 'pending' } }),
      this.prisma.artisanProfile.count({ where: { status: 'approved' } }),
      this.prisma.artisanProfile.count({ where: { status: 'rejected' } }),
      this.prisma.product.count({ where: { status: 'pending' } }),
      this.prisma.product.count({ where: { status: 'approved' } }),
      this.prisma.product.count({ where: { status: 'rejected' } }),
      this.prisma.order.count(),
      this.prisma.order.aggregate({ _sum: { price: true } }),
    ]);

    return {
      totalUsers,
      artisans: { pending: artisansPending, approved: artisansApproved, rejected: artisansRejected },
      products: { pending: productsPending, approved: productsApproved, rejected: productsRejected },
      totalOrders,
      revenue: { total: revenue._sum.price ?? 0, currency: 'NGN' },
    };
  }

  async listArtisans(page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;
    const [totalItems, items] = await Promise.all([
      this.prisma.artisanProfile.count(),
      this.prisma.artisanProfile.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { user: true },
      }),
    ]);

    return {
      data: items.map((a) => ({
        id: a.userId,
        status: a.status,
        name: a.user.name,
        email: a.user.email,
        brandName: a.brandName,
        createdAt: a.createdAt.toISOString(),
      })),
      pagination: {
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
        totalItems,
      },
    };
  }

  async getArtisan(id: number) {
    const profile = await this.prisma.artisanProfile.findUnique({
      where: { userId: id },
      include: { user: true, products: true },
    });
    if (!profile) {
      throw new NotFoundException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });
    }
    return profile;
  }

  async patchArtisanStatus(id: number, status: 'approved' | 'rejected', reason?: string) {
    if (!['approved', 'rejected'].includes(status)) {
      throw new BadRequestException({ message: 'Invalid status' });
    }

    await this.prisma.artisanProfile.update({
      where: { userId: id },
      data: { status, rejectionReason: reason ?? null },
    });

    return { id, status, rejectionReason: reason ?? null };
  }

  async listProducts(page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;
    const [totalItems, items] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.product.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { provider: true },
      }),
    ]);

    return {
      data: items.map((p) => ({
        id: p.id,
        status: p.status,
        name: p.name,
        artisan: p.provider?.name ?? null,
        providerId: p.providerId,
        createdAt: p.createdAt.toISOString(),
      })),
      pagination: {
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
        totalItems,
      },
    };
  }

  async getProduct(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { provider: { include: { artisanProfile: true } } },
    });
    if (!product) {
      throw new NotFoundException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });
    }
    return productToDto(product);
  }

  async patchProductStatus(id: number, status: 'approved' | 'rejected', reason?: string) {
    if (!['approved', 'rejected'].includes(status)) {
      throw new BadRequestException({ message: 'Invalid status' });
    }

    await this.prisma.product.update({
      where: { id },
      data: { status, rejectionReason: reason ?? null },
    });

    return { id, status, rejectionReason: reason ?? null };
  }

  async listUsers(page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;
    const [totalItems, items] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { roles: { include: { role: true } } },
      }),
    ]);

    return {
      data: items.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        roles: u.roles.map((r) => r.role.name),
        createdAt: u.createdAt.toISOString(),
      })),
      pagination: {
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
        totalItems,
      },
    };
  }

  async getUser(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: { include: { role: true } },
        artisanProfile: true,
        addresses: true,
      },
    });
    if (!user) {
      throw new NotFoundException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });
    }
    const { passwordHash: _, ...safe } = user as typeof user & { passwordHash: string };
    return safe;
  }
}
