import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { activeProductWhere } from '../common/active-product';
import { productToDto } from '../common/product-mapper';
import { CartService } from '../customers/cart.service';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly notifications: NotificationsService,
    private readonly cart: CartService,
  ) {}

  async dashboard() {
    const [
      totalUsers,
      totalArtisans,
      artisansPending,
      artisansApproved,
      artisansRejected,
      totalProducts,
      productsPending,
      productsApproved,
      productsRejected,
      totalOrders,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.artisanProfile.count(),
      this.prisma.artisanProfile.count({ where: { status: 'pending' } }),
      this.prisma.artisanProfile.count({ where: { status: 'approved' } }),
      this.prisma.artisanProfile.count({ where: { status: 'rejected' } }),
      this.prisma.product.count({ where: activeProductWhere }),
      this.prisma.product.count({ where: { status: 'pending', ...activeProductWhere } }),
      this.prisma.product.count({ where: { status: 'approved', ...activeProductWhere } }),
      this.prisma.product.count({ where: { status: 'rejected', ...activeProductWhere } }),
      this.prisma.order.count(),
    ]);

    return {
      totalUsers,
      totalArtisans,
      artisansByStatus: {
        pending: artisansPending,
        approved: artisansApproved,
        rejected: artisansRejected,
      },
      totalProducts,
      productsByStatus: {
        pending: productsPending,
        approved: productsApproved,
        rejected: productsRejected,
      },
      totalOrders,
    };
  }

  async listArtisans(page: number, pageSize: number, status?: string) {
    const skip = (page - 1) * pageSize;
    const where = status ? { status } : {};
    const [totalItems, items] = await Promise.all([
      this.prisma.artisanProfile.count({ where }),
      this.prisma.artisanProfile.findMany({
        where,
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
        businessName: a.businessName,
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
      include: { user: true },
    });
    if (!profile) {
      throw new NotFoundException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });
    }

    const [productCount, orderCount] = await Promise.all([
      this.prisma.product.count({ where: { providerId: id, ...activeProductWhere } }),
      this.prisma.order.count({ where: { providerId: id } }),
    ]);

    const { passwordHash: _, ...user } = profile.user;

    return {
      artisanProfile: {
        userId: profile.userId,
        brandName: profile.brandName,
        firstName: profile.firstName,
        lastName: profile.lastName,
        about: profile.about,
        description: profile.description,
        country: profile.country,
        address: profile.address,
        city: profile.city,
        state: profile.state,
        location: profile.location,
        category: profile.category,
        styleTags: profile.styleTags,
        serviceCategories: profile.serviceCategories,
        heroImage: profile.heroImage,
        storeImageUrl: profile.storeImageUrl,
        coverImageUrl: profile.coverImageUrl,
        images: profile.images,
        status: profile.status,
        rejectionReason: profile.rejectionReason,
        verified: profile.verified,
        featured: profile.featured,
        rating: profile.rating,
        reviewCount: profile.reviewCount,
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
      },
      businessProfile: {
        businessName: profile.businessName,
        paymentSchedule: profile.paymentSchedule,
        depositPercentage: profile.depositPercentage,
        refundPolicy: profile.refundPolicy,
        acceptedPaymentMethods: profile.acceptedPaymentMethods,
        installmentsAvailable: profile.installmentsAvailable,
        installmentDetails: profile.installmentDetails,
        customOrdersEnabled: profile.customOrdersEnabled,
        rushOrderEnabled: profile.rushOrderEnabled,
        rushOrderSurchargePercent: profile.rushOrderSurchargePercent,
        estimatedDeliveryDays: profile.estimatedDeliveryDays,
      },
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt.toISOString(),
      },
      productCount,
      orderCount,
    };
  }

  async patchArtisanStatus(id: number, status: 'approved' | 'rejected', reason?: string) {
    if (!['approved', 'rejected'].includes(status)) {
      throw new BadRequestException({ message: 'Invalid status', code: 'VALIDATION_ERROR' });
    }

    const updated = await this.prisma.artisanProfile.update({
      where: { userId: id },
      data: { status, rejectionReason: reason ?? null },
      include: { user: true },
    });

    return {
      id: updated.userId,
      status: updated.status,
      rejectionReason: updated.rejectionReason,
      brandName: updated.brandName,
      email: updated.user.email,
    };
  }

  async listProducts(page: number, pageSize: number, status?: string) {
    const skip = (page - 1) * pageSize;
    const where = status
      ? { status, ...activeProductWhere }
      : { ...activeProductWhere };
    const [totalItems, items] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
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
        category: p.category,
        price: p.price,
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
    const product = await this.prisma.product.findFirst({
      where: { id, ...activeProductWhere },
      include: { provider: { include: { artisanProfile: true } } },
    });
    if (!product) {
      throw new NotFoundException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });
    }
    return productToDto(product);
  }

  async patchProductStatus(
    id: number,
    status: 'approved' | 'rejected' | 'draft',
    reason?: string,
  ) {
    if (!['approved', 'rejected', 'draft'].includes(status)) {
      throw new BadRequestException({ message: 'Invalid status', code: 'VALIDATION_ERROR' });
    }

    const existing = await this.prisma.product.findFirst({
      where: { id, ...activeProductWhere },
    });
    if (!existing) {
      throw new NotFoundException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: { status, rejectionReason: reason ?? null },
    });

    return {
      id: updated.id,
      status: updated.status,
      rejectionReason: updated.rejectionReason,
      name: updated.name,
    };
  }

  async removeProduct(productId: number, adminUserId: number, reason?: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, ...activeProductWhere },
    });
    if (!product) {
      throw new NotFoundException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });
    }

    const artisanUserId = product.providerId;

    await this.prisma.$transaction([
      this.prisma.wishlistItem.deleteMany({ where: { productId } }),
      this.prisma.productReview.deleteMany({ where: { productId } }),
      this.prisma.product.update({
        where: { id: productId },
        data: { deletedAt: new Date() },
      }),
      this.prisma.adminAuditLog.create({
        data: {
          action: 'product_removed',
          adminUserId,
          targetType: 'product',
          targetId: productId,
          reason: reason?.trim() || null,
          metadata: {
            productName: product.name,
            providerId: product.providerId,
          },
        },
      }),
    ]);

    this.cart.purgeProductFromAllCarts(productId);

    if (artisanUserId) {
      await this.notifications.notifyProductRemovedByAdmin({
        artisanUserId,
        productId,
        productName: product.name,
        reason,
      });
      await this.refreshArtisanRating(artisanUserId);
    }
  }

  private async refreshArtisanRating(artisanId: number) {
    const products = await this.prisma.product.findMany({
      where: { providerId: artisanId, ...activeProductWhere },
      select: { id: true },
    });
    const productIds = products.map((p) => p.id);
    if (productIds.length === 0) {
      await this.prisma.artisanProfile.update({
        where: { userId: artisanId },
        data: { rating: 0, reviewCount: 0 },
      });
      return;
    }

    const agg = await this.prisma.productReview.aggregate({
      where: { productId: { in: productIds }, status: 'approved' },
      _avg: { rating: true },
      _count: { id: true },
    });

    await this.prisma.artisanProfile.update({
      where: { userId: artisanId },
      data: {
        rating: agg._avg.rating ?? 0,
        reviewCount: agg._count.id,
      },
    });
  }

  async listUsers(page: number, pageSize: number, role?: string, status?: string) {
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (role) {
      where.roles = { some: { role: { name: role } } };
    }
    if (status === 'suspended') {
      where.status = 'suspended';
    }

    const [totalItems, items] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { roles: { include: { role: true } }, artisanProfile: true },
      }),
    ]);

    return {
      data: items.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        roles: u.roles.map((r) => r.role.name),
        artisanStatus: u.artisanProfile?.status ?? null,
        status: u.status ?? 'active',
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
    const { passwordHash: _, roles, artisanProfile, addresses, ...rest } = user;

    return {
      ...rest,
      createdAt: rest.createdAt.toISOString(),
      updatedAt: rest.updatedAt.toISOString(),
      roles: roles.map((r) => r.role.name),
      artisanProfile: artisanProfile
        ? {
            userId: artisanProfile.userId,
            brandName: artisanProfile.brandName,
            businessName: artisanProfile.businessName,
            status: artisanProfile.status,
            category: artisanProfile.category,
            city: artisanProfile.city,
            state: artisanProfile.state,
          }
        : null,
      customerProfile: addresses.length > 0 ? { addresses } : null,
    };
  }

  async createUser(body: {
    name: string;
    email: string;
    phone?: string;
    role: 'customer' | 'artisan' | 'admin';
    temporaryPassword: string;
    businessName?: string;
    category?: string;
  }) {
    const email = body.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException({
        message: 'Email already in use',
        code: 'VALIDATION_ERROR',
      });
    }

    if (body.role === 'artisan' && !body.businessName?.trim()) {
      throw new BadRequestException({
        message: 'businessName is required for artisan role',
        code: 'VALIDATION_ERROR',
      });
    }

    const passwordHash = await bcrypt.hash(body.temporaryPassword, 12);
    const user = await this.prisma.user.create({
      data: {
        name: body.name.trim(),
        email,
        phone: body.phone?.trim() || null,
        passwordHash,
        status: 'active',
      },
    });

    await this.prisma.role.upsert({
      where: { name: body.role },
      update: {},
      create: { name: body.role },
    });
    const roleRow = await this.prisma.role.findUnique({
      where: { name: body.role },
    });
    if (roleRow) {
      await this.prisma.userRole.create({
        data: { userId: user.id, roleId: roleRow.id },
      });
    }

    if (body.role === 'artisan') {
      await this.prisma.artisanProfile.create({
        data: {
          userId: user.id,
          brandName: body.businessName!.trim(),
          businessName: body.businessName!.trim(),
          category: body.category?.trim() || null,
          status: 'pending',
        },
      });
    }

    const { passwordHash: _, ...safe } = user;
    return {
      ...safe,
      createdAt: safe.createdAt.toISOString(),
      updatedAt: safe.updatedAt.toISOString(),
      roles: [body.role],
    };
  }

  async resetUserPassword(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });
    }

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let temporaryPassword = '';
    const bytes = randomBytes(10);
    for (let i = 0; i < 10; i++) {
      temporaryPassword += chars[bytes[i] % chars.length];
    }

    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    return { temporaryPassword };
  }

  async patchUserStatus(id: number, status: 'active' | 'suspended') {
    if (!['active', 'suspended'].includes(status)) {
      throw new BadRequestException({ message: 'Invalid status', code: 'VALIDATION_ERROR' });
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status },
      include: { roles: { include: { role: true } } },
    });

    return {
      id: updated.id,
      status: updated.status,
      name: updated.name,
      email: updated.email,
      roles: updated.roles.map((r) => r.role.name),
    };
  }

  async deleteUser(id: number, adminId: number) {
    if (id === adminId) {
      throw new BadRequestException({
        message: 'Admin accounts cannot be deleted from the portal.',
        code: 'VALIDATION_ERROR',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });
    if (!user) {
      throw new NotFoundException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });
    }

    const isAdmin = user.roles.some((r) => r.role.name === 'admin');
    if (isAdmin) {
      throw new BadRequestException({
        message: 'Admin accounts cannot be deleted from the portal.',
        code: 'VALIDATION_ERROR',
      });
    }

    await this.prisma.user.delete({ where: { id } });
    return { success: true };
  }

  listOrders(query: Record<string, unknown>) {
    return this.orders.adminList(query);
  }

  getOrder(id: number) {
    return this.orders.adminGetById(id);
  }

  patchOrder(id: number, body: Record<string, unknown>) {
    return this.orders.adminPatch(id, body);
  }
}
