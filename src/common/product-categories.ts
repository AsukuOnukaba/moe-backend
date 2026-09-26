/** Canonical product categories — must stay in sync with frontend PRODUCT_CATEGORIES. */
export const PRODUCT_CATEGORIES = [
  'tailoring',
  'arts_and_crafts',
  'shoemaking',
  'beauty',
  'leatherwork',
  'jewellery',
  'home_and_decor',
  'paintings_and_canvas',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

/**
 * One-time / legacy mapping for old DB values and display labels.
 * Used by data migrations and optional write-time normalization.
 */
export const LEGACY_CATEGORY_MIGRATION: Record<string, ProductCategory> = {
  accessories: 'jewellery',
  furniture: 'home_and_decor',
  art: 'arts_and_crafts',
  canvas: 'paintings_and_canvas',
  crafts: 'arts_and_crafts',
  'arts & crafts': 'arts_and_crafts',
  'home & decor': 'home_and_decor',
  'paintings and canvas': 'paintings_and_canvas',
  'canvas & painting': 'paintings_and_canvas',
  'canvas & art': 'paintings_and_canvas',
};

export function isValidProductCategory(value: string): value is ProductCategory {
  const key = value.trim().toLowerCase();
  return (PRODUCT_CATEGORIES as readonly string[]).includes(key);
}

export function normalizeProductCategory(value: string): string {
  const key = value.trim().toLowerCase();
  if ((PRODUCT_CATEGORIES as readonly string[]).includes(key)) return key;
  if (LEGACY_CATEGORY_MIGRATION[key]) return LEGACY_CATEGORY_MIGRATION[key];
  return key;
}
