import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { Category } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { deriveSlugFromLabel } from './category-slug';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

export type CategoryListItem = {
  id: string;
  slug: string;
  label: string;
  icon: string | null;
  isSeed: boolean;
  productCount: number;
};

export type CategoryRecord = {
  id: string;
  slug: string;
  label: string;
  icon: string | null;
  isSeed: boolean;
  sortOrder: number;
};

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<CategoryListItem[]> {
    const [categories, productCounts] = await Promise.all([
      this.prisma.category.findMany({
        orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      }),
      this.prisma.product.groupBy({
        by: ['category'],
        _count: { id: true },
        where: { category: { not: null }, deletedAt: null },
      }),
    ]);

    const countBySlug = new Map(
      productCounts.map((row) => [row.category!, row._count.id]),
    );

    return categories.map((category) => ({
      ...this.toListItem(category, countBySlug.get(category.slug) ?? 0),
      value: category.slug,
      iconKey: category.icon,
      order: category.sortOrder,
    }));
  }

  async create(dto: CreateCategoryDto): Promise<CategoryRecord> {
    const slug = (dto.slug?.trim() || deriveSlugFromLabel(dto.label)) || '';
    if (!slug) {
      throw new ConflictException({
        message: 'Could not derive a valid slug from label',
        code: 'VALIDATION_ERROR',
      });
    }

    const existing = await this.prisma.category.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException({
        message: 'A category with this slug already exists',
        code: 'VALIDATION_ERROR',
      });
    }

    const maxSort = await this.prisma.category.aggregate({
      _max: { sortOrder: true },
    });

    const created = await this.prisma.category.create({
      data: {
        slug,
        label: dto.label.trim(),
        icon: dto.icon?.trim() || 'Tag',
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    });

    return this.toRecord(created);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryRecord> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException({
        message: 'Category not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    if (dto.slug !== undefined && dto.slug !== category.slug) {
      const productCount = await this.countProductsForSlug(category.slug);
      if (productCount > 0) {
        throw new ConflictException({
          message: 'Slug cannot be changed while products use this category',
          code: 'VALIDATION_ERROR',
        });
      }
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.label !== undefined ? { label: dto.label.trim() } : {}),
        ...(dto.icon !== undefined ? { icon: dto.icon?.trim() || 'Tag' } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });

    return this.toRecord(updated);
  }

  async remove(id: string): Promise<void> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException({
        message: 'Category not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    await this.clearProductsForCategory(category);
    await this.prisma.category.delete({ where: { id } });
  }

  async bulkRemove(ids: string[]): Promise<{ deleted: number; clearedProducts: number }> {
    const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    if (unique.length === 0) {
      throw new BadRequestException({
        message: 'ids must not be empty',
        code: 'VALIDATION_ERROR',
      });
    }

    const categories = await this.prisma.category.findMany({
      where: { id: { in: unique } },
    });
    if (categories.length === 0) {
      throw new NotFoundException({
        message: 'No matching categories found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    let clearedProducts = 0;
    for (const category of categories) {
      clearedProducts += await this.clearProductsForCategory(category);
    }

    const result = await this.prisma.category.deleteMany({
      where: { id: { in: categories.map((c) => c.id) } },
    });

    return { deleted: result.count, clearedProducts };
  }

  private async clearProductsForCategory(category: Category): Promise<number> {
    const result = await this.prisma.product.updateMany({
      where: {
        deletedAt: null,
        OR: [{ category: category.slug }, { category: category.label }],
      },
      data: { category: null },
    });
    return result.count;
  }

  private async countProductsForSlug(slug: string): Promise<number> {
    return this.prisma.product.count({
      where: { category: slug, deletedAt: null },
    });
  }

  private async countArtisansForSlug(slug: string): Promise<number> {
    return this.prisma.artisanProfile.count({
      where: { category: slug, status: 'approved' },
    });
  }

  private toListItem(
    category: Category,
    productCount: number,
  ): CategoryListItem {
    return {
      id: category.id,
      slug: category.slug,
      label: category.label,
      icon: category.icon,
      isSeed: category.isSeed,
      productCount,
    };
  }

  private toRecord(category: Category): CategoryRecord {
    return {
      id: category.id,
      slug: category.slug,
      label: category.label,
      icon: category.icon,
      isSeed: category.isSeed,
      sortOrder: category.sortOrder,
    };
  }
}
