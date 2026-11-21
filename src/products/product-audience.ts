export const PRODUCT_AUDIENCES = ['men', 'women', 'children', 'unisex'] as const;
export type ProductAudience = (typeof PRODUCT_AUDIENCES)[number];

export const AUDIENCE_REQUIRED_CATEGORIES = ['tailoring', 'shoemaking'] as const;

const WOMEN = /\b(women's|womens|women|woman|ladies|lady|female)\b/gi;
const MEN = /\b(men's|mens|men|man|male|gentlemen|gentleman)\b/gi;
const CHILDREN = /\b(children's|children|child|kids|kid|boys|boy|girls|girl|babies|baby|toddlers|toddler)\b/gi;
const UNISEX = /\b(unisex|gender[ -]?neutral)\b/gi;
const FOOTWEAR = /\b(shoes?|footwear|sandals?|boots?|sneakers?|slippers?|loafers?|heels?)\b/gi;
const CLOTHING = /\b(clothes?|clothing|wear|dress(?:es)?|shirts?|trousers?|agbada|kaftans?|suits?|traditional attire)\b/gi;

export function normalizeProductAudiences(values?: unknown): ProductAudience[] {
  if (!Array.isArray(values)) return [];
  const allowed = new Set<string>(PRODUCT_AUDIENCES);
  return [...new Set(values.map((value) => String(value).trim().toLowerCase()))]
    .filter((value): value is ProductAudience => allowed.has(value));
}

export function requiresAudienceClassification(category?: string | null): boolean {
  return (AUDIENCE_REQUIRED_CATEGORIES as readonly string[]).includes(
    (category ?? '').trim().toLowerCase(),
  );
}

export function inferAudienceSuggestion(product: {
  name?: string | null;
  description?: string | null;
}): ProductAudience[] {
  const text = `${product.name ?? ''} ${product.description ?? ''}`.toLowerCase();
  const found: ProductAudience[] = [];
  if (UNISEX.test(text)) found.push('unisex');
  UNISEX.lastIndex = 0;
  if (CHILDREN.test(text)) found.push('children');
  CHILDREN.lastIndex = 0;
  if (WOMEN.test(text)) found.push('women');
  WOMEN.lastIndex = 0;
  if (MEN.test(text)) found.push('men');
  MEN.lastIndex = 0;
  return normalizeProductAudiences(found);
}

export function parseAudienceSearch(query: string): {
  audience?: ProductAudience;
  category?: 'tailoring' | 'shoemaking';
  remainingQuery: string;
} {
  const text = query.trim().toLowerCase();
  let audience: ProductAudience | undefined;
  if (UNISEX.test(text)) audience = 'unisex';
  UNISEX.lastIndex = 0;
  if (CHILDREN.test(text)) audience = 'children';
  CHILDREN.lastIndex = 0;
  if (!audience && WOMEN.test(text)) audience = 'women';
  WOMEN.lastIndex = 0;
  if (!audience && MEN.test(text)) audience = 'men';
  MEN.lastIndex = 0;

  let category: 'tailoring' | 'shoemaking' | undefined;
  if (FOOTWEAR.test(text)) category = 'shoemaking';
  FOOTWEAR.lastIndex = 0;
  if (!category && CLOTHING.test(text)) category = 'tailoring';
  CLOTHING.lastIndex = 0;

  const structuredQuery = Boolean(audience || category);
  const remainingQuery = structuredQuery
    ? text
    .replace(UNISEX, ' ')
    .replace(CHILDREN, ' ')
    .replace(WOMEN, ' ')
    .replace(MEN, ' ')
    .replace(FOOTWEAR, ' ')
    .replace(CLOTHING, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
        .replace(/\s+/g, ' ')
    : query.trim();

  return { audience, category, remainingQuery };
}

export function audienceWhere(audience: ProductAudience) {
  if (audience === 'children') return { designedFor: { has: 'children' } };
  if (audience === 'unisex') return { designedFor: { has: 'unisex' } };
  return {
    OR: [
      { designedFor: { has: audience } },
      { designedFor: { has: 'unisex' } },
    ],
  };
}
