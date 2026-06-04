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
  { id: 'beauty', name: 'Beauty' },
  { id: 'accessories', name: 'Accessories' },
  { id: 'furniture', name: 'Furniture' },
  { id: 'art', name: 'Art' },
  { id: 'canvas', name: 'Canvas & Art (legacy)' },
  { id: 'crafts', name: 'Crafts (legacy)' },
] as const;

export const SERVICE_CATEGORY_NAMES = SERVICE_CATEGORIES.map((c) => c.name);

export function mergeServiceCategoryNames(fromDb: string[]): string[] {
  return [...new Set([...SERVICE_CATEGORY_NAMES, ...fromDb])].sort((a, b) =>
    a.localeCompare(b),
  );
}
