import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

function splitCsv(value: string | null) {
  if (!value) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

function productToDto(p: any) {
  const price = typeof p.price === 'number' ? p.price : 0;
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? '',
    priceRange: { min: price, max: price },
    currency: p.currency ?? 'NGN',
    estimatedDeliveryDays: p.estimatedDeliveryDays ?? 7,
    materials: p.materials ?? '',
    tags: splitCsv(p.tags ?? null),
    images: Array.isArray(p.images) ? p.images : (p.imageUrl ? [p.imageUrl] : []),
    category: p.category ?? null,
    providerId: p.providerId,
    featured: p.featured ?? false,
    isBestSeller: p.isBestSeller ?? false,
    isTrending: p.isTrending ?? false,
    isNewArrival: p.isNewArrival ?? false,
    discountPercent: p.discountPercent ?? null,
    originalPrice: p.originalPrice ?? null,
  };
}

function providerToDto(user: any, ap: any) {
  return {
    id: user.id,
    brandName: ap.brandName ?? user.name,
    firstName: ap.firstName ?? null,
    lastName: ap.lastName ?? null,
    about: ap.about ?? null,
    city: ap.city ?? null,
    state: ap.state ?? null,
    phone: user.phone ?? null,
    email: user.email,
    rating: ap.rating ?? 0,
    reviewCount: ap.reviewCount ?? 0,
    verified: ap.verified ?? false,
    featured: ap.featured ?? false,
    estimatedDeliveryDays: ap.estimatedDeliveryDays ?? 7,
    heroImage: ap.heroImage ?? null,
    customOrdersEnabled: ap.customOrdersEnabled ?? false,
    category: ap.category ?? null,
    styleTags: splitCsv(ap.styleTags),
    serviceCategories: splitCsv(ap.serviceCategories),
  };
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(q: string, type: string) {
    if (!q || q.trim().length < 2) {
      return { products: [], providers: [], categories: [] };
    }

    const query = q.trim();
    const t = type || 'all';

    const categories = [
      { id: 'tailoring', name: 'Tailoring' },
      { id: 'shoemaking', name: 'Shoemaking' },
      { id: 'beauty', name: 'Beauty' },
      { id: 'leatherwork', name: 'Leatherwork' },
      { id: 'crafts', name: 'Crafts' },
      { id: 'canvas', name: 'Canvas' },
    ];

    const includeProducts = t === 'all' || t === 'products';
    const includeProviders = t === 'all' || t === 'providers';
    const includeCategories = t === 'all' || t === 'categories';

    const [products, providers] = await Promise.all([
      includeProducts
        ? this.prisma.product.findMany({
            where: {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
                { materials: { contains: query, mode: 'insensitive' } },
                { tags: { contains: query, mode: 'insensitive' } },
              ],
            },
            take: 10,
            orderBy: { updatedAt: 'desc' },
          })
        : Promise.resolve([]),
      includeProviders
        ? this.prisma.user.findMany({
            where: {
              roles: { some: { role: { name: 'artisan' } } },
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { phone: { contains: query, mode: 'insensitive' } },
                { email: { contains: query, mode: 'insensitive' } },
                { artisanProfile: { about: { contains: query, mode: 'insensitive' } } },
              ],
            } as any,
            include: { artisanProfile: true },
            take: 10,
          })
        : Promise.resolve([]),
    ]);

    return {
      products: (products as any[]).map(productToDto),
      providers: (providers as any[]).map((u) => providerToDto(u, u.artisanProfile)),
      categories: includeCategories
        ? categories.filter((c) => c.id.includes(query.toLowerCase()) || c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 10)
        : [],
    };
  }
}

