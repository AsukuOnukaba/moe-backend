import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { activeProductWhere } from '../common/active-product';
import {
  variationTypeToDto,
  type VariationTypeDto,
} from '../common/variation-mapper';
import { PrismaService } from '../database/prisma.service';
import type {
  ReplaceProductVariationsDto,
  VariationTypeInputDto,
} from './dto/product-variation.dto';

@Injectable()
export class ProductVariationsService {
  constructor(private readonly prisma: PrismaService) {}

  private requireArtisan(user: AccessTokenPayload) {
    if (user.role !== 'artisan') {
      throw new ForbiddenException({ message: 'Forbidden', code: 'FORBIDDEN' });
    }
    return user.sub;
  }

  private async ownedProduct(userId: number, productId: number) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, providerId: userId, ...activeProductWhere },
    });
    if (!product) {
      throw new NotFoundException({
        message: 'Product not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    return product;
  }

  async listForProduct(productId: number): Promise<VariationTypeDto[]> {
    const rows = await this.prisma.productVariationType.findMany({
      where: { productId },
      include: { options: true },
      orderBy: { typeName: 'asc' },
    });
    return rows.map(variationTypeToDto);
  }

  async replaceAll(
    user: AccessTokenPayload,
    productId: number,
    dto: ReplaceProductVariationsDto,
  ) {
    const userId = this.requireArtisan(user);
    await this.ownedProduct(userId, productId);
    return this.replaceForProduct(productId, dto.variationTypes ?? []);
  }

  /** Used by create/update product when variationTypes is in the body. */
  async replaceForProduct(
    productId: number,
    types: VariationTypeInputDto[],
  ): Promise<{ variationTypes: VariationTypeDto[] }> {
    for (const t of types) {
      if (!t.typeName?.trim()) {
        throw new BadRequestException({
          message: 'Each variation type requires typeName',
          code: 'VALIDATION_ERROR',
        });
      }
      if (!Array.isArray(t.options)) {
        throw new BadRequestException({
          message: `Variation type ${t.typeName} requires options array`,
          code: 'VALIDATION_ERROR',
        });
      }
      if (t.isEnabled !== false && t.options.length === 0) {
        // Free-text types may have empty options — allow empty when enabled.
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.productVariationType.deleteMany({ where: { productId } });
      for (const t of types) {
        await tx.productVariationType.create({
          data: {
            productId,
            typeName: t.typeName.trim(),
            isEnabled: t.isEnabled !== false,
            isRequired: !!t.isRequired,
            options: {
              create: (t.options ?? []).map((o, j) => ({
                label: o.label.trim(),
                value: o.value.trim(),
                colorHex: o.colorHex ?? null,
                priceOverride:
                  o.priceOverride === undefined ? null : o.priceOverride,
                stockCount: o.stockCount === undefined ? null : o.stockCount,
                isAvailable: o.isAvailable !== false,
                position: o.position ?? j,
              })),
            },
          },
        });
      }
    });

    return { variationTypes: await this.listForProduct(productId) };
  }

  async toggleType(
    user: AccessTokenPayload,
    productId: number,
    typeId: string,
    isEnabled: boolean,
  ) {
    const userId = this.requireArtisan(user);
    await this.ownedProduct(userId, productId);
    const existing = await this.prisma.productVariationType.findFirst({
      where: { id: typeId, productId },
    });
    if (!existing) {
      throw new NotFoundException({
        message: 'Variation type not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    const updated = await this.prisma.productVariationType.update({
      where: { id: typeId },
      data: { isEnabled },
      include: { options: true },
    });
    return variationTypeToDto(updated);
  }

  async updateOptionStock(
    user: AccessTokenPayload,
    productId: number,
    typeId: string,
    optionId: string,
    stockCount: number | null,
  ) {
    const userId = this.requireArtisan(user);
    await this.ownedProduct(userId, productId);
    const option = await this.prisma.variationOption.findFirst({
      where: {
        id: optionId,
        variationTypeId: typeId,
        variationType: { productId },
      },
    });
    if (!option) {
      throw new NotFoundException({
        message: 'Variation option not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    const updated = await this.prisma.variationOption.update({
      where: { id: optionId },
      data: {
        stockCount,
        ...(stockCount === 0 ? { isAvailable: false } : {}),
        ...(stockCount != null && stockCount > 0 ? { isAvailable: true } : {}),
      },
    });
    return {
      id: updated.id,
      stockCount: updated.stockCount,
      isAvailable: updated.isAvailable,
    };
  }
}
