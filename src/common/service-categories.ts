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
  { id: 'arts_and_crafts', name: 'Arts & Crafts' },
  { id: 'shoemaking', name: 'Shoemaking' },
  { id: 'beauty', name: 'Beauty' },
  { id: 'leatherwork', name: 'Leatherwork' },
  { id: 'jewellery', name: 'Jewellery' },
  { id: 'home_and_decor', name: 'Home & Decor' },
] as const;

export const SERVICE_CATEGORY_NAMES = SERVICE_CATEGORIES.map((c) => c.name);

export function mergeServiceCategoryNames(fromDb: string[]): string[] {
  return [...new Set([...SERVICE_CATEGORY_NAMES, ...fromDb])].sort((a, b) =>
    a.localeCompare(b),
  );
}
