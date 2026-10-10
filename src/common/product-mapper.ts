export function toTagArray(value: string | null | undefined): string[] {
  if (!value) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

export function buildPriceRange(p: {
  price?: number | null;
  originalPrice?: number | null;
}): { min: number; max: number } {
  const min = typeof p.price === 'number' ? p.price : 0;
  const max = p.originalPrice ?? min;
  return { min, max };
}

export function productToDto(p: {
  id: number;
  name: string;
  description?: string | null;
  price?: number | null;
  originalPrice?: number | null;
  currency?: string | null;
  estimatedDeliveryDays?: number | null;
  estimatedDelivery?: string | null;
  materials?: string | null;
  tags?: string | null;
  images?: string[] | null;
  imageUrl?: string | null;
  category?: string | null;
  providerId?: number | null;
  featured?: boolean | null;
  isBestSeller?: boolean | null;
  isTrending?: boolean | null;
  isNewArrival?: boolean | null;
  discountPercent?: number | null;
  status?: string | null;
  customisationRequired?: boolean | null;
  stockCount?: number | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  keywords?: { keyword: { term: string } }[] | { term: string }[];
  variationTypes?: any[];
}) {
  const keywords = Array.isArray(p.keywords)
    ? p.keywords.map((k: any) =>
        k?.keyword?.term != null ? { term: k.keyword.term } : { term: k.term },
      )
    : [];
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? '',
    priceRange: buildPriceRange(p),
    currency: p.currency ?? 'NGN',
    estimatedDeliveryDays: p.estimatedDeliveryDays ?? 7,
    estimatedDelivery: p.estimatedDelivery ?? null,
    materials: p.materials ?? '',
    tags: toTagArray(p.tags ?? null),
    images: Array.isArray(p.images) ? p.images : (p.imageUrl ? [p.imageUrl] : []),
    category: p.category ?? null,
    providerId: p.providerId ?? null,
    featured: p.featured ?? false,
    isBestSeller: p.isBestSeller ?? false,
    isTrending: p.isTrending ?? false,
    isNewArrival: p.isNewArrival ?? false,
    discountPercent: p.discountPercent ?? null,
    originalPrice: p.originalPrice ?? null,
    status: p.status ?? null,
    customisationRequired: p.customisationRequired ?? false,
    stockCount: p.stockCount ?? null,
    metaTitle: p.metaTitle ?? null,
    metaDescription: p.metaDescription ?? null,
    keywords,
    ...(Array.isArray(p.variationTypes)
      ? {
          variationTypes: p.variationTypes.map((vt: any) => ({
            id: vt.id,
            typeName: vt.typeName,
            isEnabled: vt.isEnabled !== false,
            isRequired: !!vt.isRequired,
            options: Array.isArray(vt.options)
              ? [...vt.options]
                  .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
                  .map((o: any) => {
                    const soldOut =
                      o.isAvailable === false ||
                      (o.stockCount != null && o.stockCount === 0);
                    return {
                      id: o.id,
                      label: o.label,
                      value: o.value,
                      colorHex: o.colorHex ?? null,
                      priceOverride: o.priceOverride ?? null,
                      stockCount: o.stockCount ?? null,
                      isAvailable: !soldOut,
                      position: o.position ?? 0,
                    };
                  })
              : [],
          })),
        }
      : {}),
  };
}

