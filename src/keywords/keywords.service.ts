import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { normalizeKeywordList } from '../sections/sections.service';

@Injectable()
export class KeywordsService {
  constructor(private readonly prisma: PrismaService) {}

  async syncProductKeywords(productId: number, keywords?: string[]) {
    if (keywords === undefined) return;
    const terms = normalizeKeywordList(keywords);
    await this.prisma.$transaction(async (tx) => {
      await tx.productKeyword.deleteMany({ where: { productId } });
      for (const term of terms) {
        const kw = await tx.keyword.upsert({
          where: { term },
          create: { term },
          update: {},
        });
        await tx.productKeyword.create({
          data: { productId, keywordId: kw.id },
        });
      }
    });
  }

  async syncArtisanKeywords(artisanId: number, keywords?: string[]) {
    if (keywords === undefined) return;
    const terms = normalizeKeywordList(keywords);
    await this.prisma.$transaction(async (tx) => {
      await tx.artisanKeyword.deleteMany({ where: { artisanId } });
      for (const term of terms) {
        const kw = await tx.keyword.upsert({
          where: { term },
          create: { term },
          update: {},
        });
        await tx.artisanKeyword.create({
          data: { artisanId, keywordId: kw.id },
        });
      }
    });
  }
}
