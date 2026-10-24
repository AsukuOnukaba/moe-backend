/** UI labels for the artisan orders screen, mapped onto stored statuses. */
export const ARTISAN_ORDER_VIEWS = {
  new: ['pending'],
  pending: ['confirmed', 'in_progress', 'ready', 'shipped', 'approved'],
  completed: ['delivered'],
} as const;

export type ArtisanOrderView = keyof typeof ARTISAN_ORDER_VIEWS;

export function isArtisanOrderView(value: string): value is ArtisanOrderView {
  return value === 'new' || value === 'pending' || value === 'completed';
}

export function artisanOrderView(status: string): ArtisanOrderView | 'other' {
  if ((ARTISAN_ORDER_VIEWS.new as readonly string[]).includes(status)) return 'new';
  if ((ARTISAN_ORDER_VIEWS.pending as readonly string[]).includes(status)) return 'pending';
  if ((ARTISAN_ORDER_VIEWS.completed as readonly string[]).includes(status)) return 'completed';
  return 'other';
}

export function summarizeArtisanOrders(rows: Array<{ status: string; count: number }>) {
  const summary = { new: 0, pending: 0, completed: 0, all: 0 };
  for (const row of rows) {
    summary.all += row.count;
    const view = artisanOrderView(row.status);
    if (view !== 'other') summary[view] += row.count;
  }
  return summary;
}
