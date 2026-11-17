import {
  NEW_ORDERS_READINESS_STATUSES,
  type ReadinessWorkflowStatus,
} from './readiness.constants';

/**
 * Artisan order screens. New is the intake queue:
 * - Phase 1 readiness-active orders (awaiting response through approved-awaiting-payout)
 * - Legacy pending orders without a readiness workflow
 * Pending is every open order. Completed is delivered only.
 */
export const ARTISAN_ORDER_VIEWS = {
  new: ['pending'],
  pending: ['pending', 'confirmed', 'in_progress', 'ready', 'shipped', 'approved'],
  completed: ['delivered'],
} as const;

export type ArtisanOrderView = keyof typeof ARTISAN_ORDER_VIEWS;

export function isArtisanOrderView(value: string): value is ArtisanOrderView {
  return value === 'new' || value === 'pending' || value === 'completed';
}

export function artisanOrderViews(status: string): ArtisanOrderView[] {
  return (Object.keys(ARTISAN_ORDER_VIEWS) as ArtisanOrderView[]).filter((view) =>
    (ARTISAN_ORDER_VIEWS[view] as readonly string[]).includes(status),
  );
}

/** Narrowest label. A newly placed order is New, which is also Pending. */
export function artisanOrderView(status: string): ArtisanOrderView | 'other' {
  const views = artisanOrderViews(status);
  if (views.includes('new')) return 'new';
  if (views.includes('pending')) return 'pending';
  if (views.includes('completed')) return 'completed';
  return 'other';
}

export function isNewOrdersReadinessStatus(
  status: string | null | undefined,
): boolean {
  return (
    !!status &&
    NEW_ORDERS_READINESS_STATUSES.includes(status as ReadinessWorkflowStatus)
  );
}

/** Prisma where-fragment for artisan New Orders (Phase 1/2 + legacy). */
export function artisanNewOrdersWhere(providerId: number) {
  return {
    providerId,
    OR: [
      {
        readinessWorkflowStatus: { in: [...NEW_ORDERS_READINESS_STATUSES] },
        productionStartedAt: null,
        status: {
          notIn: [
            'cancelled',
            'rejected',
            'in_progress',
            'ready',
            'shipped',
            'delivered',
          ],
        },
      },
      {
        readinessWorkflowStatus: null,
        status: 'pending',
      },
    ],
  };
}

export function summarizeArtisanOrders(
  rows: Array<{
    status: string;
    count: number;
    readinessWorkflowStatus?: string | null;
  }>,
) {
  const summary = { new: 0, pending: 0, completed: 0, all: 0 };
  for (const row of rows) {
    summary.all += row.count;
    for (const view of artisanOrderViews(row.status)) {
      summary[view] += row.count;
    }
  }
  return summary;
}

/**
 * Accurate New-Orders count when readiness workflow is present.
 * `statusRows` = groupBy status; `newReadinessCount` = count of readiness-active new queue.
 */
export function summarizeArtisanOrdersWithReadiness(
  statusRows: Array<{ status: string; count: number }>,
  newReadinessCount: number,
  legacyPendingWithoutReadiness: number,
) {
  const base = summarizeArtisanOrders(statusRows);
  return {
    ...base,
    new: newReadinessCount + legacyPendingWithoutReadiness,
  };
}
