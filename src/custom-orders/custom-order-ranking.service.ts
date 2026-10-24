import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';

const NEUTRAL_SATISFACTION = 50;

/**
 * Custom-order discovery ranking (separate from ArtisanScore curation).
 *
 * compositeRank =
 *   fulfilmentRate * 0.40 +
 *   satisfactionScore * 0.35 +
 *   (1 / (avgResponseTimeHrs + 1)) * 100 * 0.25
 */
@Injectable()
export class CustomOrderRankingService {
  private readonly logger = new Logger(CustomOrderRankingService.name);
  private recalculating = false;

  constructor(private readonly prisma: PrismaService) {}

  isRecalculating() {
    return this.recalculating;
  }

  async calculateRank(artisanId: number) {
    const profile = await this.prisma.artisanProfile.findUnique({
      where: { userId: artisanId },
      select: { userId: true, isCustomOrderEligible: true, customOrdersEnabled: true },
    });
    if (!profile) {
      throw new NotFoundException({
        message: 'Artisan not found',
        code: 'NOT_FOUND',
      });
    }

    const orders = await this.prisma.customOrder.findMany({
      where: { artisanId, status: { not: 'in_review' } },
      select: {
        status: true,
        createdAt: true,
        updatedAt: true,
        artisanResponse: true,
      },
    });

    const total = orders.length;
    const completed = orders.filter((o) => o.status === 'completed').length;
    const fulfilmentRate =
      total === 0 ? 0 : Math.min(100, Math.max(0, (completed / total) * 100));

    // No per-custom-order ratings yet — use artisan review quality as proxy.
    const reviewAgg = await this.prisma.artisanReview.aggregate({
      where: { artisanId },
      _avg: { rating: true },
      _count: { _all: true },
    });
    const satisfactionScore =
      !reviewAgg._count._all || reviewAgg._avg.rating == null
        ? NEUTRAL_SATISFACTION
        : Math.min(100, Math.max(0, (reviewAgg._avg.rating / 5) * 100));

    const responseHrs: number[] = [];
    for (const o of orders) {
      if (o.status === 'pending' && !o.artisanResponse) continue;
      const hrs =
        (o.updatedAt.getTime() - o.createdAt.getTime()) / (1000 * 60 * 60);
      if (hrs >= 0) responseHrs.push(hrs);
    }
    const avgResponseTimeHrs =
      responseHrs.length === 0
        ? 48
        : Math.round(
            (responseHrs.reduce((a, b) => a + b, 0) / responseHrs.length) * 100,
          ) / 100;

    const compositeRank =
      fulfilmentRate * 0.4 +
      satisfactionScore * 0.35 +
      (1 / (avgResponseTimeHrs + 1)) * 100 * 0.25;

    const now = new Date();
    const row = await this.prisma.customOrderRank.upsert({
      where: { artisanId },
      create: {
        artisanId,
        fulfilmentRate,
        satisfactionScore,
        avgResponseTimeHrs,
        compositeRank,
        lastCalculatedAt: now,
      },
      update: {
        fulfilmentRate,
        satisfactionScore,
        avgResponseTimeHrs,
        compositeRank,
        lastCalculatedAt: now,
      },
    });

    return {
      artisanId: row.artisanId,
      fulfilmentRate: row.fulfilmentRate,
      satisfactionScore: row.satisfactionScore,
      avgResponseTimeHrs: row.avgResponseTimeHrs,
      compositeRank: row.compositeRank,
      lastCalculatedAt: row.lastCalculatedAt,
    };
  }

  async recalculateAll(): Promise<{ processed: number }> {
    if (this.recalculating) return { processed: 0 };
    this.recalculating = true;
    let processed = 0;
    try {
      const eligible = await this.prisma.artisanProfile.findMany({
        where: {
          OR: [
            { isCustomOrderEligible: true },
            { customOrdersEnabled: true },
          ],
        },
        select: { userId: true },
        orderBy: { userId: 'asc' },
      });
      for (const a of eligible) {
        try {
          await this.calculateRank(a.userId);
          processed += 1;
        } catch (err) {
          this.logger.warn(
            `Custom order rank failed for artisan ${a.userId}: ${String(err)}`,
          );
        }
      }
    } finally {
      this.recalculating = false;
    }
    return { processed };
  }

  /** Daily 03:00 — custom order discovery ranks. */
  @Cron('0 3 * * *', { timeZone: process.env.APP_TIMEZONE || 'Africa/Lagos' })
  async handleDailyRecalc() {
    if (this.recalculating) {
      this.logger.warn('Skipping custom-order rank recalc — already running');
      return;
    }
    this.logger.log('Starting scheduled custom-order rank recalculation');
    const result = await this.recalculateAll();
    this.logger.log(
      `Custom-order rank recalc finished: ${result.processed} artisans`,
    );
  }

  async listRanks(page = 1, pageSize = 50) {
    const pageNum = Math.max(1, Number(page) || 1);
    const take = Math.min(Math.max(Number(pageSize) || 50, 1), 100);
    const skip = (pageNum - 1) * take;

    const [total, rows] = await Promise.all([
      this.prisma.customOrderRank.count(),
      this.prisma.customOrderRank.findMany({
        orderBy: { compositeRank: 'desc' },
        skip,
        take,
        include: {
          artisan: {
            select: {
              userId: true,
              brandName: true,
              businessName: true,
              isCustomOrderEligible: true,
              user: { select: { name: true, email: true } },
            },
          },
        },
      }),
    ]);

    return {
      total,
      page: pageNum,
      pageSize: take,
      items: rows.map((r) => ({
        artisanId: r.artisanId,
        name:
          r.artisan?.brandName ||
          r.artisan?.businessName ||
          r.artisan?.user?.name ||
          `Artisan #${r.artisanId}`,
        email: r.artisan?.user?.email ?? null,
        isCustomOrderEligible: r.artisan?.isCustomOrderEligible ?? false,
        fulfilmentRate: r.fulfilmentRate,
        satisfactionScore: r.satisfactionScore,
        avgResponseTimeHrs: r.avgResponseTimeHrs,
        compositeRank: r.compositeRank,
        lastCalculatedAt: r.lastCalculatedAt,
      })),
    };
  }
}
