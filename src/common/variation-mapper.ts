export type VariationOptionDto = {
  id: string;
  label: string;
  value: string;
  colorHex: string | null;
  priceOverride: number | null;
  stockCount: number | null;
  isAvailable: boolean;
  position: number;
};

export type VariationTypeDto = {
  id: string;
  typeName: string;
  isEnabled: boolean;
  isRequired: boolean;
  options: VariationOptionDto[];
};

export function variationOptionToDto(o: {
  id: string;
  label: string;
  value: string;
  colorHex: string | null;
  priceOverride: number | null;
  stockCount: number | null;
  isAvailable: boolean;
  position: number;
}): VariationOptionDto {
  const soldOut =
    o.isAvailable === false ||
    (o.stockCount != null && o.stockCount === 0);
  return {
    id: o.id,
    label: o.label,
    value: o.value,
    colorHex: o.colorHex,
    priceOverride: o.priceOverride,
    stockCount: o.stockCount,
    isAvailable: !soldOut,
    position: o.position,
  };
}

export function variationTypeToDto(t: {
  id: string;
  typeName: string;
  isEnabled: boolean;
  isRequired: boolean;
  options: Array<{
    id: string;
    label: string;
    value: string;
    colorHex: string | null;
    priceOverride: number | null;
    stockCount: number | null;
    isAvailable: boolean;
    position: number;
  }>;
}): VariationTypeDto {
  const options = [...t.options]
    .sort((a, b) => a.position - b.position)
    .map(variationOptionToDto);
  return {
    id: t.id,
    typeName: t.typeName,
    isEnabled: t.isEnabled,
    isRequired: t.isRequired,
    options,
  };
}
