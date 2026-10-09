/** Remove HTML tags from free-text input. */
export function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]*>/g, '').trim();
}

export function sanitizeFreeText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const stripped = stripHtmlTags(String(value));
  return stripped.length > 0 ? stripped : '';
}
