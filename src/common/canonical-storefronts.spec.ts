import { excludedStorefrontIds, storefrontKey, uniqueIds } from './canonical-storefronts';

const adaobi = {
  brandName: 'Adaobi Atelier Lagos',
  businessName: 'Adaobi Atelier Lagos',
  about: 'Bespoke Ankara and lace couture for weddings, aso-ebi, and corporate events across Lagos.',
  city: 'Lekki',
  state: 'Lagos',
  category: 'tailoring',
  country: 'Nigeria',
  firstName: '',
  lastName: '',
};

describe('canonical storefronts', () => {
  it('keeps the lowest id when the same storefront was created more than once', () => {
    const excluded = excludedStorefrontIds([
      { id: 64, ...adaobi },
      { id: 23, ...adaobi },
      { id: 26, ...adaobi },
    ]);
    expect(excluded.sort((a, b) => a - b)).toEqual([26, 64]);
    expect(storefrontKey({ id: 23, ...adaobi })).toBe(storefrontKey({ id: 64, ...adaobi }));
  });

  it('does not collapse a different business that happens to share a product name', () => {
    const excluded = excludedStorefrontIds([
      { id: 23, ...adaobi },
      { id: 44, ...adaobi, brandName: 'Another Atelier', about: 'A different workshop in the same city.' },
    ]);
    expect(excluded).toEqual([]);
  });

  it('does not collapse incomplete profiles', () => {
    expect(excludedStorefrontIds([
      { id: 1, ...adaobi, about: '' },
      { id: 2, ...adaobi, about: '' },
    ])).toEqual([]);
  });

  it('keeps the first occurrence of a product id', () => {
    expect(uniqueIds([51, 66, 51, 256])).toEqual([51, 66, 256]);
  });
});
