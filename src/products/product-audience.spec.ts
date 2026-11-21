import {
  audienceWhere,
  inferAudienceSuggestion,
  normalizeProductAudiences,
  parseAudienceSearch,
  requiresAudienceClassification,
} from './product-audience';

describe('product audience classification', () => {
  it('normalizes multiple audiences without duplicates', () => {
    expect(normalizeProductAudiences(['Women', 'unisex', 'women', 'invalid'])).toEqual([
      'women',
      'unisex',
    ]);
  });

  it.each([
    ["Women's shoes", { audience: 'women', category: 'shoemaking', remainingQuery: '' }],
    ["men's traditional clothing", { audience: 'men', category: 'tailoring', remainingQuery: 'traditional' }],
    ['kids clothes', { audience: 'children', category: 'tailoring', remainingQuery: '' }],
    ['girls sandals', { audience: 'children', category: 'shoemaking', remainingQuery: '' }],
    ['female red boots', { audience: 'women', category: 'shoemaking', remainingQuery: 'red' }],
  ])('extracts structured search intent from %s', (query, expected) => {
    expect(parseAudienceSearch(query)).toEqual(expected);
  });

  it('suggests only evidence present in product text', () => {
    expect(inferAudienceSuggestion({ name: 'Ladies leather loafers' })).toEqual(['women']);
    expect(inferAudienceSuggestion({ name: 'Handmade leather loafers' })).toEqual([]);
  });

  it('requires audience only for current clothing and footwear categories', () => {
    expect(requiresAudienceClassification('tailoring')).toBe(true);
    expect(requiresAudienceClassification('shoemaking')).toBe(true);
    expect(requiresAudienceClassification('home_and_decor')).toBe(false);
  });

  it('does not add adult unisex to the children filter', () => {
    expect(audienceWhere('women')).toEqual({
      OR: [
        { designedFor: { has: 'women' } },
        { designedFor: { has: 'unisex' } },
      ],
    });
    expect(audienceWhere('children')).toEqual({ designedFor: { has: 'children' } });
  });
});
