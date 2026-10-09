const STOPWORDS = new Set([
  'about',
  'after',
  'also',
  'been',
  'before',
  'being',
  'between',
  'both',
  'from',
  'have',
  'into',
  'more',
  'most',
  'other',
  'some',
  'such',
  'than',
  'that',
  'their',
  'them',
  'then',
  'there',
  'these',
  'they',
  'this',
  'those',
  'through',
  'under',
  'very',
  'what',
  'when',
  'where',
  'which',
  'while',
  'with',
  'your',
  'and',
  'for',
  'are',
  'but',
  'not',
  'you',
  'all',
  'can',
  'had',
  'her',
  'was',
  'one',
  'our',
  'out',
  'the',
]);

/** Significant terms: lowercase, length > 3, skip stopwords. */
export function extractSignificantTerms(
  ...sources: (string | null | undefined)[]
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    if (!source) continue;
    const tokens = String(source)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
      .split(/\s+/);
    for (const token of tokens) {
      const term = token.trim();
      if (term.length <= 3 || STOPWORDS.has(term) || seen.has(term)) continue;
      seen.add(term);
      out.push(term);
    }
  }
  return out;
}
