import { priceOrderLine } from './order-pricing';

describe('order pricing', () => {
  const types = [
    {
      typeName: 'size',
      isEnabled: true,
      options: [
        { value: 'm', label: 'Medium', priceOverride: null },
        { value: 'l', label: 'Large', priceOverride: 18000 },
      ],
    },
    {
      typeName: 'color',
      isEnabled: true,
      options: [{ value: 'gold', label: 'Gold', priceOverride: 22000 }],
    },
  ];

  it('uses the catalogue price and ignores a lower client total', () => {
    const priced = priceOrderLine({
      catalogPrice: 15000,
      quantity: 2,
      rushOrder: false,
      surchargePercent: 25,
      variationTypes: types,
      selection: { size: 'm' },
    });
    expect(priced).toEqual({ basePrice: 30000, rushSurcharge: 0, finalPrice: 30000 });
  });

  it('uses the highest selected variation override and applies rush on the server', () => {
    const priced = priceOrderLine({
      catalogPrice: 15000,
      quantity: 1,
      rushOrder: true,
      surchargePercent: 20,
      variationTypes: types,
      selection: { size: 'l', color: 'gold' },
    });
    expect(priced).toEqual({ basePrice: 22000, rushSurcharge: 4400, finalPrice: 26400 });
  });

  it('returns null when the catalogue has no price', () => {
    expect(
      priceOrderLine({
        catalogPrice: 0,
        quantity: 1,
        rushOrder: false,
        surchargePercent: 25,
        variationTypes: [],
        selection: {},
      }),
    ).toBeNull();
  });
});
