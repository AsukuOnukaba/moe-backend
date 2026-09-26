/**
 * Normalize a CSV string, string array, or nullish value into a trimmed string[].
 * Used for serviceCategories (and similar list fields) that accept legacy CSV input.
 */
export function toStringList(
  value: string | string[] | null | undefined,
): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.map((s) => String(s).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/** Normalize for Prisma String[] writes; null clears to []. */
export function toStoredStringList(
  value: string | string[] | null | undefined,
): string[] {
  return toStringList(value);
}
