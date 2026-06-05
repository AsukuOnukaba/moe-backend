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
}) {
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
  };
}
