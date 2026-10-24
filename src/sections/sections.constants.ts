export const SECTION_KEYS = [
  'featured_picks',
  'best_sellers',
  'featured_artisans',
  'featured_styles',
  'seasonal_picks',
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_LABELS: Record<SectionKey, string> = {
  featured_picks: 'Featured Picks',
  best_sellers: 'Best Sellers',
  featured_artisans: 'Featured Artisans',
  featured_styles: "Editor's Recommendations",
  seasonal_picks: 'Seasonal Picks',
};

export const SECTION_ITEM_TYPES: Record<SectionKey, 'product' | 'artisan'> = {
  featured_picks: 'product',
  best_sellers: 'product',
  featured_artisans: 'artisan',
  featured_styles: 'product',
  seasonal_picks: 'product',
};

export const MIN_SECTION_ITEMS = 4;

export function isSectionKey(value: string): value is SectionKey {
  return (SECTION_KEYS as readonly string[]).includes(value);
}
