/**
 * Canonical service categories for artisan signup and filters.
 * Register sends `name` values (or `id` if the client maps them).
 */
export type ServiceCategory = {
  id: string;
  name: string;
};

export const SERVICE_CATEGORIES: readonly ServiceCategory[] = [
  { id: 'tailoring', name: 'Tailoring' },
  { id: 'shoemaking', name: 'Shoemaking' },
  { id: 'leatherwork', name: 'Leatherwork' },
  { id: 'leather-goods', name: 'Leather Goods' },
  { id: 'canvas', name: 'Canvas & Art' },
  { id: 'crafts', name: 'Crafts' },
  { id: 'jewelry', name: 'Jewelry' },
  { id: 'furniture', name: 'Furniture' },
  { id: 'home-decor', name: 'Home Decor' },
  { id: 'footwear', name: 'Footwear' },
  { id: 'beauty', name: 'Beauty' },
  { id: 'fashion', name: 'Fashion' },
] as const;

export const SERVICE_CATEGORY_NAMES = SERVICE_CATEGORIES.map((c) => c.name);

export function mergeServiceCategoryNames(fromDb: string[]): string[] {
  return [...new Set([...SERVICE_CATEGORY_NAMES, ...fromDb])].sort((a, b) =>
    a.localeCompare(b),
  );
}
