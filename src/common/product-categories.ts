/** Canonical product categories — legacy values are rejected on new writes. */
export const PRODUCT_CATEGORIES = [
  'tailoring',
  'arts_and_crafts',
  'shoemaking',
  'beauty',
  'leatherwork',
  'jewellery',
  'home_and_decor',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

/** One-time migration mapping for legacy DB values. */
export const LEGACY_CATEGORY_MIGRATION: Record<string, ProductCategory> = {
  accessories: 'jewellery',
  furniture: 'home_and_decor',
  art: 'arts_and_crafts',
  canvas: 'arts_and_crafts',
  crafts: 'arts_and_crafts',
};

export function isValidProductCategory(value: string): value is ProductCategory {
  const key = value.trim().toLowerCase();
  return (PRODUCT_CATEGORIES as readonly string[]).includes(key);
}

export function normalizeProductCategory(value: string): string {
  return value.trim().toLowerCase();
}
