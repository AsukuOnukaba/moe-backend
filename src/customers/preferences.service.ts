import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';

@Injectable()
export class PreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(row: {
    userId: number;
    categories: string[];
    styleTags: string[];
    budget: number;
    updatedAt: Date;
  }) {
    return {
      categories: row.categories,
      styleTags: row.styleTags,
      budget: row.budget,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async get(user: AccessTokenPayload) {
    const row = await this.prisma.userPreference.findUnique({
      where: { userId: user.sub },
    });
    return row ? this.toDto(row) : null;
  }

  async upsert(
    user: AccessTokenPayload,
    body: {
      categories?: string[];
      styleTags?: string[];
      budget?: number;
    },
  ) {
    const existing = await this.prisma.userPreference.findUnique({
      where: { userId: user.sub },
    });

    const row = await this.prisma.userPreference.upsert({
      where: { userId: user.sub },
      create: {
        userId: user.sub,
        categories: Array.isArray(body?.categories) ? body.categories : [],
        styleTags: Array.isArray(body?.styleTags) ? body.styleTags : [],
        budget: typeof body?.budget === 'number' ? body.budget : 0,
      },
      update: {
        categories: Array.isArray(body?.categories)
          ? body.categories
          : existing?.categories ?? [],
        styleTags: Array.isArray(body?.styleTags)
          ? body.styleTags
          : existing?.styleTags ?? [],
        budget:
          typeof body?.budget === 'number'
            ? body.budget
            : (existing?.budget ?? 0),
      },
    });

    return this.toDto(row);
  }

  async clear(user: AccessTokenPayload) {
    await this.prisma.userPreference.deleteMany({
      where: { userId: user.sub },
    });
    return { success: true };
  }
}
