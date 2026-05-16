import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { productToDto } from '../common/product-mapper';

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  async addByProductId(user: AccessTokenPayload, productId: number) {
    if (!productId) {
      throw new BadRequestException({ message: 'Missing productId' });
    }
    return this.add(user, { productId });
  }

  async add(user: AccessTokenPayload, body: { productId?: number; id?: number }) {
    const userId = user.sub;
    const productId = Number(body?.productId ?? body?.id ?? 0);
    if (!productId) {
      throw new BadRequestException({ message: 'Missing productId' });
    }

    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new BadRequestException({ message: 'Product not found' });
    }

    const existing = await this.prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId, productId } },
    });

    if (existing) {
      return productToDto(product);
    }

    await this.prisma.wishlistItem.create({ data: { userId, productId } });
    return productToDto(product);
  }

  async listFullProducts(user: AccessTokenPayload) {
    const userId = user.sub;
    const items = await this.prisma.wishlistItem.findMany({
      where: { userId },
      include: { product: true },
      orderBy: { addedAt: 'desc' },
    });

    return {
      data: items.map((item) => productToDto(item.product)),
      total: items.length,
    };
  }

  async listAll(user: AccessTokenPayload) {
    return this.listFullProducts(user);
  }

  async remove(user: AccessTokenPayload, productId: number) {
    const userId = user.sub;
    const existing = await this.prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId, productId } },
    });

    if (!existing) {
      throw new BadRequestException({ message: 'Not found' });
    }

    await this.prisma.wishlistItem.delete({
      where: { userId_productId: { userId, productId } },
    });
  }
}
