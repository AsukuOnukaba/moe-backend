export const SECTION_KEYS = [
  'featured_picks',
  'featured_artisans',
  'featured_styles',
  'seasonal_picks',
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_ITEM_TYPES: Record<SectionKey, 'product' | 'artisan'> = {
  featured_picks: 'product',
  featured_artisans: 'artisan',
  featured_styles: 'product',
  seasonal_picks: 'product',
};

export const MIN_SECTION_ITEMS = 4;

export function isSectionKey(value: string): value is SectionKey {
  return (SECTION_KEYS as readonly string[]).includes(value);
}
