import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { normalizeKeywordList } from '../sections/sections.service';
import { extractSignificantTerms } from './keyword-extract';

@Injectable()
export class KeywordsService {
  constructor(private readonly prisma: PrismaService) {}

  private async replaceKeywordLinks(
    tx: Pick<PrismaService, 'productKeyword' | 'artisanKeyword' | 'keyword'>,
    kind: 'product' | 'artisan',
    entityId: number,
    terms: string[],
  ) {
    if (kind === 'product') {
      await tx.productKeyword.deleteMany({ where: { productId: entityId } });
    } else {
      await tx.artisanKeyword.deleteMany({ where: { artisanId: entityId } });
    }
    for (const term of terms) {
      const kw = await tx.keyword.upsert({
        where: { term },
        create: { term },
        update: {},
      });
      if (kind === 'product') {
        await tx.productKeyword.create({
          data: { productId: entityId, keywordId: kw.id },
        });
      } else {
        await tx.artisanKeyword.create({
          data: { artisanId: entityId, keywordId: kw.id },
        });
      }
    }
  }

  async syncProductKeywords(productId: number, keywords?: string[]) {
    if (keywords === undefined) return;
    const terms = normalizeKeywordList(keywords);
    await this.prisma.$transaction(async (tx) => {
      await this.replaceKeywordLinks(tx, 'product', productId, terms);
    });
  }

  async syncArtisanKeywords(artisanId: number, keywords?: string[]) {
    if (keywords === undefined) return;
    const terms = normalizeKeywordList(keywords);
    await this.prisma.$transaction(async (tx) => {
      await this.replaceKeywordLinks(tx, 'artisan', artisanId, terms);
    });
  }

  async reindexProductKeywords(
    productId: number,
    explicitKeywords?: string[],
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { keywords: { include: { keyword: true } } },
    });
    if (!product) return;

    const existingManual =
      explicitKeywords === undefined
        ? product.keywords.map((k) => k.keyword.term)
        : explicitKeywords;

    const extracted = extractSignificantTerms(
      product.name,
      product.description,
      product.tags,
      product.materials,
      product.category,
    );

    const terms = normalizeKeywordList([...existingManual, ...extracted]);
    await this.prisma.$transaction(async (tx) => {
      await this.replaceKeywordLinks(tx, 'product', productId, terms);
    });
  }

  async reindexArtisanKeywords(
    artisanId: number,
    explicitKeywords?: string[],
  ) {
    const profile = await this.prisma.artisanProfile.findUnique({
      where: { userId: artisanId },
      include: { keywords: { include: { keyword: true } } },
    });
    if (!profile) return;

    const existingManual =
      explicitKeywords === undefined
        ? profile.keywords.map((k) => k.keyword.term)
        : explicitKeywords;

    const extracted = extractSignificantTerms(
      profile.brandName,
      profile.businessName,
      profile.about,
      profile.description,
      profile.category,
      profile.city,
      profile.state,
      profile.country,
      profile.location,
      ...(profile.serviceCategories ?? []),
      profile.styleTags,
    );

    const terms = normalizeKeywordList([...existingManual, ...extracted]);
    await this.prisma.$transaction(async (tx) => {
      await this.replaceKeywordLinks(tx, 'artisan', artisanId, terms);
    });
  }
}
