import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

/** Neutral baseline when a metric has insufficient data (0–100 scale). */
export const NEUTRAL_SCORE = 50;

const SUCCESS_STATUSES = new Set(['delivered']);
const FAILED_STATUSES = new Set(['cancelled', 'rejected']);

export type ArtisanScoreBreakdown = {
  artisanId: number;
  orderCompletionRate: number;
  avgResponseTimeHrs: number | null;
  reviewQualityScore: number;
  activityScore: number;
  compositeScore: number;
  lastCalculatedAt: Date;
};

/**
 * Internal admin scoring (0–100 components).
 *
 * composite =
 *   orderCompletionRate * 0.35 +
 *   reviewQualityScore  * 0.30 +
 *   activityScore       * 0.20 +
 *   responseScore       * 0.15
 *
 * responseScore = 100 / (avgResponseTimeHrs + 1) when measured;
 * otherwise NEUTRAL_SCORE (50) when no customer→provider pairs exist.
 *
 * Activity favors recency: login/product create/update in last 30/90 days.
 */
@Injectable()
export class ArtisanScoringService {
  private readonly logger = new Logger(ArtisanScoringService.name);
  private recalculating = false;

  constructor(private readonly prisma: PrismaService) {}

  isRecalculating() {
    return this.recalculating;
  }

  async calculateScore(artisanId: number): Promise<ArtisanScoreBreakdown> {
    const profile = await this.prisma.artisanProfile.findUnique({
      where: { userId: artisanId },
      select: { userId: true, updatedAt: true, createdAt: true },
    });
    if (!profile) {
      throw new NotFoundException({
        message: 'Artisan not found',
        code: 'NOT_FOUND',
      });
    }

    const [orderCompletionRate, response, reviewQualityScore, activityScore] =
      await Promise.all([
        this.calcOrderCompletionRate(artisanId),
        this.calcResponseMetrics(artisanId),
        this.calcReviewQualityScore(artisanId),
        this.calcActivityScore(artisanId, profile.updatedAt),
      ]);

    const responseScore =
      response.avgResponseTimeHrs == null
        ? NEUTRAL_SCORE
        : clamp(100 / (response.avgResponseTimeHrs + 1), 0, 100);

    const compositeScore = clamp(
      orderCompletionRate * 0.35 +
        reviewQualityScore * 0.3 +
        activityScore * 0.2 +
        responseScore * 0.15,
      0,
      100,
    );

    const now = new Date();
    const row = await this.prisma.artisanScore.upsert({
      where: { artisanId },
      create: {
        artisanId,
        orderCompletionRate,
        avgResponseTimeHrs: response.avgResponseTimeHrs,
        reviewQualityScore,
        activityScore,
        compositeScore,
        lastCalculatedAt: now,
      },
      update: {
        orderCompletionRate,
        avgResponseTimeHrs: response.avgResponseTimeHrs,
        reviewQualityScore,
        activityScore,
        compositeScore,
        lastCalculatedAt: now,
      },
    });

    return {
      artisanId: row.artisanId,
      orderCompletionRate: row.orderCompletionRate,
      avgResponseTimeHrs: row.avgResponseTimeHrs,
      reviewQualityScore: row.reviewQualityScore,
      activityScore: row.activityScore,
      compositeScore: row.compositeScore,
      lastCalculatedAt: row.lastCalculatedAt,
    };
  }

  async recalculateAll(): Promise<{ processed: number }> {
    if (this.recalculating) {
      return { processed: 0 };
    }
    this.recalculating = true;
    let processed = 0;
    try {
      const batchSize = 50;
      let cursor: number | undefined;
      for (;;) {
        const batch = await this.prisma.artisanProfile.findMany({
          take: batchSize,
          ...(cursor != null
            ? { skip: 1, cursor: { userId: cursor } }
            : {}),
          orderBy: { userId: 'asc' },
          select: { userId: true },
        });
        if (batch.length === 0) break;
        for (const a of batch) {
          try {
            await this.calculateScore(a.userId);
            processed += 1;
          } catch (err) {
            this.logger.warn(`Score calc failed for artisan ${a.userId}: ${String(err)}`);
          }
        }
        cursor = batch[batch.length - 1].userId;
        if (batch.length < batchSize) break;
      }
    } finally {
      this.recalculating = false;
    }
    return { processed };
  }

  async listScores(page = 1, pageSize = 50) {
    try {
      const take = Math.min(Math.max(pageSize, 1), 100);
      const skip = (Math.max(page, 1) - 1) * take;
      const [total, rows] = await Promise.all([
        this.prisma.artisanScore.count(),
        this.prisma.artisanScore.findMany({
          orderBy: { compositeScore: 'desc' },
          skip,
          take,
          include: {
            artisan: {
              select: {
                userId: true,
                brandName: true,
                businessName: true,
                category: true,
                status: true,
                rating: true,
                user: { select: { name: true, email: true, avatarUrl: true } },
              },
            },
          },
        }),
      ]);
      return {
        total,
        page: Math.max(page, 1),
        pageSize: take,
        items: rows.map((r) => ({
          artisanId: r.artisanId,
          name:
            r.artisan?.brandName ||
            r.artisan?.businessName ||
            r.artisan?.user?.name ||
            `Artisan #${r.artisanId}`,
          email: r.artisan?.user?.email ?? null,
          avatarUrl: r.artisan?.user?.avatarUrl ?? null,
          category: r.artisan?.category ?? null,
          status: r.artisan?.status ?? null,
          publicRating: r.artisan?.rating ?? null,
          orderCompletionRate: r.orderCompletionRate,
          avgResponseTimeHrs: r.avgResponseTimeHrs,
          reviewQualityScore: r.reviewQualityScore,
          activityScore: r.activityScore,
          compositeScore: r.compositeScore,
          lastCalculatedAt: r.lastCalculatedAt,
        })),
      };
    } catch (error) {
      console.error('GET /admin/artisans/scores error:', error);
      throw error;
    }
  }

  async getScore(artisanId: number) {
    let row = await this.prisma.artisanScore.findUnique({ where: { artisanId } });
    if (!row) {
      return this.calculateScore(artisanId);
    }
    return {
      artisanId: row.artisanId,
      orderCompletionRate: row.orderCompletionRate,
      avgResponseTimeHrs: row.avgResponseTimeHrs,
      reviewQualityScore: row.reviewQualityScore,
      activityScore: row.activityScore,
      compositeScore: row.compositeScore,
      lastCalculatedAt: row.lastCalculatedAt,
    };
  }

  /** Order completion: delivered / (delivered + cancelled + rejected) * 100. */
  private async calcOrderCompletionRate(artisanId: number): Promise<number> {
    const orders = await this.prisma.order.findMany({
      where: {
        providerId: artisanId,
        status: { in: [...SUCCESS_STATUSES, ...FAILED_STATUSES] },
      },
      select: { status: true },
    });
    if (orders.length === 0) return NEUTRAL_SCORE;
    const success = orders.filter((o) => SUCCESS_STATUSES.has(o.status)).length;
    return clamp((success / orders.length) * 100, 0, 100);
  }

  /**
   * Average hours from each customer message to the next provider reply
   * in the same conversation. Null when no pairs exist.
   */
  private async calcResponseMetrics(
    artisanId: number,
  ): Promise<{ avgResponseTimeHrs: number | null }> {
    const conversations = await this.prisma.conversation.findMany({
      where: { providerId: artisanId },
      select: {
        messages: {
          orderBy: { sentAt: 'asc' },
          select: { senderType: true, sentAt: true },
        },
      },
    });

    const deltasHrs: number[] = [];
    for (const c of conversations) {
      let pendingCustomerAt: Date | null = null;
      for (const m of c.messages) {
        if (m.senderType === 'customer') {
          if (!pendingCustomerAt) pendingCustomerAt = m.sentAt;
        } else if (m.senderType === 'provider' && pendingCustomerAt) {
          const hrs =
            (m.sentAt.getTime() - pendingCustomerAt.getTime()) / (1000 * 60 * 60);
          if (hrs >= 0) deltasHrs.push(hrs);
          pendingCustomerAt = null;
        }
      }
    }

    if (deltasHrs.length === 0) return { avgResponseTimeHrs: null };
    const avg = deltasHrs.reduce((a, b) => a + b, 0) / deltasHrs.length;
    return { avgResponseTimeHrs: Math.round(avg * 100) / 100 };
  }

  /** Average artisan review rating (1–5) normalized to 0–100. */
  private async calcReviewQualityScore(artisanId: number): Promise<number> {
    const agg = await this.prisma.artisanReview.aggregate({
      where: { artisanId },
      _avg: { rating: true },
      _count: { _all: true },
    });
    if (!agg._count._all || agg._avg.rating == null) return NEUTRAL_SCORE;
    return clamp((agg._avg.rating / 5) * 100, 0, 100);
  }

  /**
   * Recency-weighted activity (0–100):
   * - product created in last 30d: +40
   * - product updated in last 30d: +30
   * - profile updated in last 30d: +20
   * - any of the above in 31–90d: half credit
   */
  private async calcActivityScore(
    artisanId: number,
    profileUpdatedAt: Date,
  ): Promise<number> {
    const now = Date.now();
    const d30 = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const d90 = new Date(now - 90 * 24 * 60 * 60 * 1000);

    const [created30, created90, updated30, updated90] = await Promise.all([
      this.prisma.product.count({
        where: { providerId: artisanId, deletedAt: null, createdAt: { gte: d30 } },
      }),
      this.prisma.product.count({
        where: {
          providerId: artisanId,
          deletedAt: null,
          createdAt: { gte: d90, lt: d30 },
        },
      }),
      this.prisma.product.count({
        where: {
          providerId: artisanId,
          deletedAt: null,
          updatedAt: { gte: d30 },
          NOT: { createdAt: { gte: d30 } },
        },
      }),
      this.prisma.product.count({
        where: {
          providerId: artisanId,
          deletedAt: null,
          updatedAt: { gte: d90, lt: d30 },
          NOT: { createdAt: { gte: d90 } },
        },
      }),
    ]);

    let score = 0;
    if (created30 > 0) score += 40;
    else if (created90 > 0) score += 20;
    if (updated30 > 0) score += 30;
    else if (updated90 > 0) score += 15;
    if (profileUpdatedAt >= d30) score += 20;
    else if (profileUpdatedAt >= d90) score += 10;

    return clamp(score, 0, 100);
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
