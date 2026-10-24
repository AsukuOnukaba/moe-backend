/**
 * Artisan order screens. New is the newly placed subset of Pending.
 * Pending is every open order, including status `pending`, so a new order
 * cannot be missed by the dashboard card. Completed is delivered only.
 * Cancelled and rejected stay on All. No stored statuses are added here.
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

export function summarizeArtisanOrders(rows: Array<{ status: string; count: number }>) {
  const summary = { new: 0, pending: 0, completed: 0, all: 0 };
  for (const row of rows) {
    summary.all += row.count;
    for (const view of artisanOrderViews(row.status)) {
      summary[view] += row.count;
    }
  }
  return summary;
}
