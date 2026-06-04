/** Canonical product categories (Task 8) plus legacy values until DB rows are migrated. */
export const PRODUCT_CATEGORIES = [
  'tailoring',
  'shoemaking',
  'leatherwork',
  'beauty',
  'accessories',
  'furniture',
  'art',
] as const;

export const LEGACY_PRODUCT_CATEGORIES = ['canvas', 'crafts'] as const;

export const ALL_PRODUCT_CATEGORIES = [
  ...PRODUCT_CATEGORIES,
  ...LEGACY_PRODUCT_CATEGORIES,
] as const;

export type ProductCategory = (typeof ALL_PRODUCT_CATEGORIES)[number];

export function isValidProductCategory(value: string): value is ProductCategory {
  const key = value.trim().toLowerCase();
  return (ALL_PRODUCT_CATEGORIES as readonly string[]).includes(key);
}

export function normalizeProductCategory(value: string): string {
  return value.trim().toLowerCase();
}
