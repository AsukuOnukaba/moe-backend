import { roundMajor } from '../common/money';

export type PricedVariationType = {
  typeName: string;
  isEnabled: boolean;
  options: { value: string; label: string; priceOverride: number | null }[];
};

/**
 * Catalogue price, with the highest selected variation price override winning.
 * Client-submitted totals are not an input.
 */
export function resolveUnitPrice(
  catalogPrice: number | null | undefined,
  types: PricedVariationType[],
  selection: Record<string, unknown> | null | undefined,
): number {
  let override: number | null = null;
  for (const type of types) {
    if (!type.isEnabled) continue;
    const selected = selection?.[type.typeName];
    if (typeof selected !== 'string' || !selected.trim()) continue;
    const option = type.options.find(
      (item) => item.value === selected || item.label === selected,
    );
    if (option?.priceOverride != null && Number.isFinite(option.priceOverride)) {
      if (override == null || option.priceOverride > override) {
        override = option.priceOverride;
      }
    }
  }
  if (override != null && override > 0) return override;
  const catalog = Number(catalogPrice ?? 0);
  return Number.isFinite(catalog) && catalog > 0 ? catalog : 0;
}

export function priceOrderLine(input: {
  catalogPrice: number | null | undefined;
  quantity?: number | null;
  rushOrder: boolean;
  surchargePercent: number;
  variationTypes: PricedVariationType[];
  selection?: Record<string, unknown> | null;
}): { basePrice: number; rushSurcharge: number; finalPrice: number } | null {
  const quantityRaw = Number(input.quantity ?? 1);
  const quantity = Number.isFinite(quantityRaw)
    ? Math.min(99, Math.max(1, Math.floor(quantityRaw)))
    : 1;
  const unit = resolveUnitPrice(
    input.catalogPrice,
    input.variationTypes,
    input.selection,
  );
  if (!(unit > 0)) return null;
  const basePrice = roundMajor(unit * quantity);
  const percent = Number.isFinite(input.surchargePercent) ? input.surchargePercent : 0;
  const rushSurcharge = input.rushOrder
    ? roundMajor(basePrice * (percent / 100))
    : 0;
  return {
    basePrice,
    rushSurcharge,
    finalPrice: roundMajor(basePrice + rushSurcharge),
  };
}
