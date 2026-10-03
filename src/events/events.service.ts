import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';

const DEDUPE_WINDOW_MS = 5 * 60 * 1000;
const MAX_METADATA_JSON_CHARS = 2000;

/** Public demand thresholds (documented single source of truth). */
export const DEMAND_THRESHOLDS = {
  viewsTodayHigh: 10,
  viewsWeekHigh: 50,
  viewsTodayShowBadge: 3,
} as const;

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async track(dto: CreateEventDto, userId: number | null) {
    if (dto.metadata != null) {
      const size = JSON.stringify(dto.metadata).length;
      if (size > MAX_METADATA_JSON_CHARS) {
        throw new HttpException(
          { message: 'metadata too large', code: 'VALIDATION_ERROR' },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
    const duplicate = await this.prisma.userBehaviourEvent.findFirst({
      where: dto.entityId
        ? {
            sessionId: dto.sessionId,
            eventType: dto.eventType,
            entityId: dto.entityId,
            createdAt: { gte: since },
          }
        : {
            sessionId: dto.sessionId,
            eventType: dto.eventType,
            entityId: null,
            createdAt: { gte: since },
          },
      select: { id: true },
    });
    if (duplicate) {
      // Idempotent no-op within the window
      return;
    }

    await this.prisma.userBehaviourEvent.create({
      data: {
        userId: userId ?? undefined,
        sessionId: dto.sessionId,
        eventType: dto.eventType,
        entityType: dto.entityType,
        entityId: dto.entityId,
        metadata: dto.metadata as object | undefined,
      },
    });
  }

  async adminSummary() {
    const now = new Date();
    const d1 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [last24h, last7d] = await Promise.all([
      this.aggregateSince(d1),
      this.aggregateSince(d7),
    ]);

    return { last24h, last7d };
  }

  async productViewStats(productId: number) {
    const startOfUtcDay = new Date();
    startOfUtcDay.setUTCHours(0, 0, 0, 0);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const entityId = String(productId);

    const [viewsToday, viewsThisWeek] = await Promise.all([
      this.prisma.userBehaviourEvent.count({
        where: {
          eventType: 'product_view',
          entityId,
          createdAt: { gte: startOfUtcDay },
        },
      }),
      this.prisma.userBehaviourEvent.count({
        where: {
          eventType: 'product_view',
          entityId,
          createdAt: { gte: weekAgo },
        },
      }),
    ]);

    const isHighDemand =
      viewsToday > DEMAND_THRESHOLDS.viewsTodayHigh ||
      viewsThisWeek > DEMAND_THRESHOLDS.viewsWeekHigh;

    return { viewsToday, viewsThisWeek, isHighDemand };
  }

  private async aggregateSince(since: Date) {
    const rows = await this.prisma.userBehaviourEvent.groupBy({
      by: ['entityType', 'entityId', 'eventType'],
      where: {
        createdAt: { gte: since },
        eventType: { in: ['product_view', 'artisan_view'] },
        entityId: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { entityId: 'desc' } },
      take: 100,
    });
    return rows.map((r) => ({
      entityType: r.entityType,
      entityId: r.entityId,
      eventType: r.eventType,
      count: r._count._all,
    }));
  }
}
