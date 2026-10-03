import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { productToDto } from '../common/product-mapper';
import { ArtisanScoringService } from '../scoring/artisan-scoring.service';
import {
  isSectionKey,
  MIN_SECTION_ITEMS,
  SECTION_ITEM_TYPES,
  SectionKey,
} from './sections.constants';
import {
  CuratedItemInputDto,
  ReorderSectionItemsDto,
  ReplaceSectionItemsDto,
} from './dto/curation.dto';

@Injectable()
export class SectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ArtisanScoringService,
  ) {}

  async listAdminSections() {
    const sections = await this.prisma.curatedSection.findMany({
      orderBy: { sectionKey: 'asc' },
      include: {
        items: { orderBy: { position: 'asc' } },
      },
    });
    return Promise.all(sections.map((s) => this.toAdminSection(s)));
  }

  async getAdminSection(sectionKey: string) {
    const section = await this.requireSection(sectionKey);
    const full = await this.prisma.curatedSection.findUniqueOrThrow({
      where: { id: section.id },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    return this.toAdminSection(full);
  }

  async replaceItems(
    sectionKey: string,
    dto: ReplaceSectionItemsDto,
    adminId: number,
  ) {
    const section = await this.requireSection(sectionKey);
    const expectedType = SECTION_ITEM_TYPES[sectionKey as SectionKey];
    await this.validateItems(dto.items, expectedType);

    const positions = dto.items.map((i, idx) => i.position ?? idx);
    if (new Set(positions).size !== positions.length) {
      throw new BadRequestException({
        message: 'Duplicate positions are not allowed',
        code: 'VALIDATION_ERROR',
      });
    }
    const itemIds = dto.items.map((i) => i.itemId);
    if (new Set(itemIds).size !== itemIds.length) {
      throw new BadRequestException({
        message: 'Duplicate items are not allowed',
        code: 'VALIDATION_ERROR',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.curatedItem.deleteMany({ where: { sectionId: section.id } });
      if (dto.items.length > 0) {
        await tx.curatedItem.createMany({
          data: dto.items.map((item, idx) => ({
            sectionId: section.id,
            itemType: item.itemType,
            itemId: String(item.itemId),
            position: item.position ?? idx,
            isActive: true,
            addedBy: String(adminId),
          })),
        });
      }
      await tx.curatedSection.update({
        where: { id: section.id },
        data: { updatedBy: String(adminId) },
      });
    });

    return this.getAdminSection(sectionKey);
  }

  async addItem(
    sectionKey: string,
    item: CuratedItemInputDto,
    adminId: number,
  ) {
    const section = await this.requireSection(sectionKey);
    const expectedType = SECTION_ITEM_TYPES[sectionKey as SectionKey];
    await this.validateItems([item], expectedType);

    const existing = await this.prisma.curatedItem.findUnique({
      where: {
        sectionId_itemId: {
          sectionId: section.id,
          itemId: String(item.itemId),
        },
      },
    });
    if (existing) {
      throw new BadRequestException({
        message: 'Item already curated in this section',
        code: 'VALIDATION_ERROR',
      });
    }

    const max = await this.prisma.curatedItem.aggregate({
      where: { sectionId: section.id },
      _max: { position: true },
    });
    const position =
      item.position ?? (max._max.position == null ? 0 : max._max.position + 1);

    await this.prisma.$transaction([
      this.prisma.curatedItem.create({
        data: {
          sectionId: section.id,
          itemType: item.itemType,
          itemId: String(item.itemId),
          position,
          isActive: true,
          addedBy: String(adminId),
        },
      }),
      this.prisma.curatedSection.update({
        where: { id: section.id },
        data: { updatedBy: String(adminId) },
      }),
    ]);

    return this.getAdminSection(sectionKey);
  }

  async removeItem(sectionKey: string, itemId: string, adminId: number) {
    const section = await this.requireSection(sectionKey);
    const row = await this.prisma.curatedItem.findUnique({
      where: {
        sectionId_itemId: { sectionId: section.id, itemId: String(itemId) },
      },
    });
    if (!row) {
      throw new NotFoundException({
        message: 'Curated item not found in section',
        code: 'NOT_FOUND',
      });
    }
    await this.prisma.$transaction([
      this.prisma.curatedItem.delete({ where: { id: row.id } }),
      this.prisma.curatedSection.update({
        where: { id: section.id },
        data: { updatedBy: String(adminId) },
      }),
    ]);
    return { ok: true };
  }

  async reorderItems(
    sectionKey: string,
    dto: ReorderSectionItemsDto,
    adminId: number,
  ) {
    const section = await this.requireSection(sectionKey);
    const existing = await this.prisma.curatedItem.findMany({
      where: { sectionId: section.id },
    });
    const byId = new Map(existing.map((e) => [e.itemId, e]));
    for (const item of dto.items) {
      if (!byId.has(String(item.itemId))) {
        throw new BadRequestException({
          message: `Item ${item.itemId} is not in this section`,
          code: 'VALIDATION_ERROR',
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        await tx.curatedItem.update({
          where: {
            sectionId_itemId: {
              sectionId: section.id,
              itemId: String(item.itemId),
            },
          },
          data: { position: item.position },
        });
      }
      await tx.curatedSection.update({
        where: { id: section.id },
        data: { updatedBy: String(adminId) },
      });
    });

    return this.getAdminSection(sectionKey);
  }

  async setSeasonalKeywords(keywords: string[], adminId: number) {
    const section = await this.requireSection('seasonal_picks');
    const normalized = normalizeKeywordList(keywords);
    await this.prisma.curatedSection.update({
      where: { id: section.id },
      data: { keywords: normalized, updatedBy: String(adminId) },
    });
    return this.getAdminSection('seasonal_picks');
  }

  /** Public section payload — no admin fields, no scores. */
  async getPublicSection(sectionKey: string) {
    if (!isSectionKey(sectionKey)) {
      throw new NotFoundException({
        message: 'Section not found',
        code: 'NOT_FOUND',
      });
    }
    const section = await this.prisma.curatedSection.findUnique({
      where: { sectionKey },
      include: {
        items: {
          where: { isActive: true },
          orderBy: { position: 'asc' },
        },
      },
    });
    if (!section || !section.isActive) {
      throw new NotFoundException({
        message: 'Section not found',
        code: 'NOT_FOUND',
      });
    }

    const expectedType = SECTION_ITEM_TYPES[sectionKey];
    const curated = await this.resolvePublicItems(
      section.items.filter((i) => i.itemType === expectedType),
      expectedType,
    );

    let items = curated;
    if (items.length < MIN_SECTION_ITEMS) {
      const exclude = new Set(items.map((i) => String(i.id)));
      const fill = await this.algorithmicFallback(
        expectedType,
        MIN_SECTION_ITEMS - items.length,
        exclude,
      );
      items = [...items, ...fill];
    }

    return {
      sectionKey: section.sectionKey,
      label: section.label,
      items,
    };
  }

  /** Seasonal curated + keyword-matched fill. Scores used only for ordering. */
  async getSeasonalMatched() {
    const section = await this.prisma.curatedSection.findUnique({
      where: { sectionKey: 'seasonal_picks' },
      include: {
        items: { where: { isActive: true }, orderBy: { position: 'asc' } },
      },
    });
    if (!section || !section.isActive) {
      throw new NotFoundException({
        message: 'Section not found',
        code: 'NOT_FOUND',
      });
    }

    const curated = await this.resolvePublicItems(
      section.items.filter((i) => i.itemType === 'product'),
      'product',
    );
    const exclude = new Set(curated.map((i) => String(i.id)));
    const terms = section.keywords.map((k) => k.toLowerCase()).filter(Boolean);

    let matched: ReturnType<typeof productToDto>[] = [];
    if (terms.length > 0) {
      const or = terms.flatMap((term) => [
        { name: { contains: term, mode: 'insensitive' as const } },
        { description: { contains: term, mode: 'insensitive' as const } },
        { tags: { contains: term, mode: 'insensitive' as const } },
        { category: { contains: term, mode: 'insensitive' as const } },
        {
          keywords: {
            some: { keyword: { term: { equals: term, mode: 'insensitive' as const } } },
          },
        },
      ]);
      const products = await this.prisma.product.findMany({
        where: {
          status: 'approved',
          deletedAt: null,
          OR: or,
        },
        orderBy: { createdAt: 'desc' },
        take: 40,
        include: { keywords: { include: { keyword: true } } },
      });
      matched = products
        .filter((p) => !exclude.has(String(p.id)))
        .map((p) => this.productPublic(p));
    }

    return {
      sectionKey: section.sectionKey,
      label: section.label,
      keywords: section.keywords,
      items: [...curated, ...matched],
    };
  }

  private async algorithmicFallback(
    type: 'product' | 'artisan',
    need: number,
    exclude: Set<string>,
  ) {
    if (need <= 0) return [];
    if (type === 'product') {
      const products = await this.prisma.product.findMany({
        where: { status: 'approved', deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: need + exclude.size + 10,
        include: { keywords: { include: { keyword: true } } },
      });
      return products
        .filter((p) => !exclude.has(String(p.id)))
        .slice(0, need)
        .map((p) => this.productPublic(p));
    }

    // Artisans: prefer highest composite score (internal), then rating.
    const scored = await this.prisma.artisanScore.findMany({
      orderBy: { compositeScore: 'desc' },
      take: need + exclude.size + 20,
      include: {
        artisan: {
          include: { user: { select: { name: true, avatarUrl: true } } },
        },
      },
    });
    const fromScores = scored
      .filter(
        (s) =>
          s.artisan.status === 'approved' && !exclude.has(String(s.artisanId)),
      )
      .slice(0, need)
      .map((s) => this.artisanPublic(s.artisan));

    if (fromScores.length >= need) return fromScores;

    const more = await this.prisma.artisanProfile.findMany({
      where: {
        status: 'approved',
        userId: {
          notIn: [
            ...[...exclude].map((id) => Number(id)).filter((n) => !Number.isNaN(n)),
            ...fromScores.map((a) => Number(a.id)),
          ],
        },
      },
      orderBy: [{ featured: 'desc' }, { rating: 'desc' }],
      take: need - fromScores.length,
      include: { user: { select: { name: true, avatarUrl: true } } },
    });
    return [...fromScores, ...more.map((a) => this.artisanPublic(a))];
  }

  private async resolvePublicItems(
    items: { itemType: string; itemId: string; position: number }[],
    type: 'product' | 'artisan',
  ) {
    const out: Array<Record<string, unknown>> = [];
    for (const item of items) {
      const id = Number(item.itemId);
      if (Number.isNaN(id)) continue;
      if (type === 'product') {
        const p = await this.prisma.product.findFirst({
          where: { id, status: 'approved', deletedAt: null },
          include: { keywords: { include: { keyword: true } } },
        });
        if (p) out.push(this.productPublic(p));
      } else {
        const a = await this.prisma.artisanProfile.findFirst({
          where: { userId: id, status: 'approved' },
          include: { user: { select: { name: true, avatarUrl: true } } },
        });
        if (a) out.push(this.artisanPublic(a));
      }
    }
    return out;
  }

  private productPublic(p: {
    id: number;
    name: string;
    description?: string | null;
    price?: number | null;
    originalPrice?: number | null;
    currency?: string | null;
    estimatedDeliveryDays?: number | null;
    estimatedDelivery?: string | null;
    materials?: string | null;
    tags?: string | null;
    images?: string[] | null;
    imageUrl?: string | null;
    category?: string | null;
    providerId?: number | null;
    featured?: boolean | null;
    isBestSeller?: boolean | null;
    isTrending?: boolean | null;
    isNewArrival?: boolean | null;
    discountPercent?: number | null;
    status?: string | null;
    customisationRequired?: boolean | null;
    stockCount?: number | null;
    metaTitle?: string | null;
    metaDescription?: string | null;
    keywords?: { keyword: { term: string } }[];
  }) {
    return {
      ...productToDto(p),
      stockCount: p.stockCount ?? null,
      metaTitle: p.metaTitle ?? null,
      metaDescription: p.metaDescription ?? null,
      keywords: (p.keywords ?? []).map((k) => ({ term: k.keyword.term })),
    };
  }

  private artisanPublic(a: {
    userId: number;
    brandName?: string | null;
    businessName?: string | null;
    description?: string | null;
    about?: string | null;
    location?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    category?: string | null;
    images?: string[] | null;
    heroImage?: string | null;
    rating?: number | null;
    reviewCount?: number | null;
    verified?: boolean | null;
    featured?: boolean | null;
    metaTitle?: string | null;
    metaDescription?: string | null;
    user?: { name: string; avatarUrl?: string | null };
  }) {
    return {
      id: a.userId,
      name: a.brandName || a.businessName || a.user?.name || 'Artisan',
      brandName: a.brandName ?? null,
      businessName: a.businessName ?? null,
      description: a.description || a.about || '',
      location: a.location || [a.city, a.state, a.country].filter(Boolean).join(', '),
      city: a.city ?? null,
      state: a.state ?? null,
      country: a.country ?? null,
      category: a.category ?? null,
      images: a.images ?? [],
      heroImage: a.heroImage ?? a.user?.avatarUrl ?? null,
      rating: a.rating ?? 0,
      reviewCount: a.reviewCount ?? 0,
      verified: a.verified ?? false,
      featured: a.featured ?? false,
      metaTitle: a.metaTitle ?? null,
      metaDescription: a.metaDescription ?? null,
    };
  }

  private async toAdminSection(section: {
    id: string;
    sectionKey: string;
    label: string;
    isActive: boolean;
    keywords: string[];
    updatedAt: Date;
    updatedBy: string | null;
    items: {
      id: string;
      itemType: string;
      itemId: string;
      position: number;
      isActive: boolean;
      addedBy: string | null;
      addedAt: Date;
    }[];
  }) {
    const expectedType = isSectionKey(section.sectionKey)
      ? SECTION_ITEM_TYPES[section.sectionKey]
      : 'product';

    const items: Array<{
      id: string;
      itemType: string;
      itemId: string;
      position: number;
      isActive: boolean;
      addedBy: string | null;
      addedAt: Date;
      preview: Record<string, unknown> | null;
      compositeScore?: number | null;
    }> = [];
    for (const item of section.items) {
      const id = Number(item.itemId);
      let preview: Record<string, unknown> | null = null;
      let compositeScore: number | null = null;
      if (!Number.isNaN(id) && item.itemType === 'product') {
        const p = await this.prisma.product.findUnique({
          where: { id },
          select: { id: true, name: true, imageUrl: true, images: true, status: true },
        });
        if (p) {
          preview = {
            id: p.id,
            name: p.name,
            image: p.imageUrl || p.images[0] || null,
            status: p.status,
          };
        }
      } else if (!Number.isNaN(id) && item.itemType === 'artisan') {
        const a = await this.prisma.artisanProfile.findUnique({
          where: { userId: id },
          select: {
            userId: true,
            brandName: true,
            businessName: true,
            status: true,
            category: true,
            user: { select: { name: true, avatarUrl: true } },
            score: { select: { compositeScore: true } },
          },
        });
        if (a) {
          preview = {
            id: a.userId,
            name: a.brandName || a.businessName || a.user.name,
            image: a.user.avatarUrl,
            status: a.status,
            category: a.category,
          };
          compositeScore = a.score?.compositeScore ?? null;
        }
      }
      items.push({
        id: item.id,
        itemType: item.itemType,
        itemId: item.itemId,
        position: item.position,
        isActive: item.isActive,
        addedBy: item.addedBy,
        addedAt: item.addedAt,
        preview,
        ...(expectedType === 'artisan' ? { compositeScore } : {}),
      });
    }

    return {
      id: section.id,
      sectionKey: section.sectionKey,
      label: section.label,
      isActive: section.isActive,
      keywords: section.keywords,
      updatedAt: section.updatedAt,
      updatedBy: section.updatedBy,
      itemCount: section.items.filter((i) => i.isActive).length,
      expectedItemType: expectedType,
      items,
    };
  }

  private async requireSection(sectionKey: string) {
    if (!isSectionKey(sectionKey)) {
      throw new BadRequestException({
        message: `Unsupported section key: ${sectionKey}`,
        code: 'VALIDATION_ERROR',
      });
    }
    const section = await this.prisma.curatedSection.findUnique({
      where: { sectionKey },
    });
    if (!section) {
      throw new NotFoundException({
        message: 'Section not found',
        code: 'NOT_FOUND',
      });
    }
    return section;
  }

  private async validateItems(
    items: CuratedItemInputDto[],
    expectedType: 'product' | 'artisan',
  ) {
    for (const item of items) {
      if (item.itemType !== expectedType) {
        throw new BadRequestException({
          message: `This section only accepts itemType "${expectedType}"`,
          code: 'VALIDATION_ERROR',
        });
      }
      const id = Number(item.itemId);
      if (!Number.isInteger(id) || id <= 0) {
        throw new BadRequestException({
          message: `Invalid itemId: ${item.itemId}`,
          code: 'VALIDATION_ERROR',
        });
      }
      if (expectedType === 'product') {
        const p = await this.prisma.product.findFirst({
          where: { id, deletedAt: null },
          select: { id: true },
        });
        if (!p) {
          throw new BadRequestException({
            message: `Product ${id} not found`,
            code: 'VALIDATION_ERROR',
          });
        }
      } else {
        const a = await this.prisma.artisanProfile.findUnique({
          where: { userId: id },
          select: { userId: true },
        });
        if (!a) {
          throw new BadRequestException({
            message: `Artisan ${id} not found`,
            code: 'VALIDATION_ERROR',
          });
        }
      }
    }
  }
}

export function normalizeKeywordList(keywords: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of keywords ?? []) {
    const term = String(raw ?? '')
      .trim()
      .toLowerCase();
    if (!term || seen.has(term)) continue;
    seen.add(term);
    out.push(term);
  }
  return out;
}
