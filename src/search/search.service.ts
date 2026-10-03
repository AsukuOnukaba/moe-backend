import { Injectable } from '@nestjs/common';
import { activeProductWhere } from '../common/active-product';
import { PrismaService } from '../database/prisma.service';
import { productToDto, toTagArray } from '../common/product-mapper';
import { toStringList } from '../common/string-list';

function splitCsv(value: string | null) {
  return toTagArray(value);
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
    serviceCategories: toStringList(ap.serviceCategories),
    metaTitle: ap.metaTitle ?? null,
    metaDescription: ap.metaDescription ?? null,
    keywords: (ap.keywords ?? []).map((k: any) => ({
      term: k.keyword?.term ?? k.term,
    })),
  };
}

/** Higher = more relevant. Never returned in API responses. */
function productRelevance(p: any, q: string): number {
  const n = (p.name ?? '').toLowerCase();
  const cat = (p.category ?? '').toLowerCase();
  const desc = (p.description ?? '').toLowerCase();
  const tags = (p.tags ?? '').toLowerCase();
  const kwTerms = (p.keywords ?? []).map((k: any) =>
    (k.keyword?.term ?? k.term ?? '').toLowerCase(),
  );
  if (n === q) return 1000;
  if (n.startsWith(q)) return 800;
  if (n.includes(q)) return 600;
  if (kwTerms.some((t: string) => t === q)) return 500;
  if (kwTerms.some((t: string) => t.includes(q))) return 420;
  if (cat === q || cat.includes(q)) return 350;
  if (tags.includes(q)) return 250;
  if (desc.includes(q)) return 100;
  return 0;
}

function providerRelevance(u: any, q: string): number {
  const ap = u.artisanProfile;
  const brand = (ap?.brandName ?? u.name ?? '').toLowerCase();
  const business = (ap?.businessName ?? '').toLowerCase();
  const about = (ap?.about ?? ap?.description ?? '').toLowerCase();
  const cats = toStringList(ap?.serviceCategories).map((c) => c.toLowerCase());
  const category = (ap?.category ?? '').toLowerCase();
  const kwTerms = (ap?.keywords ?? []).map((k: any) =>
    (k.keyword?.term ?? '').toLowerCase(),
  );
  if (brand === q || business === q) return 1000;
  if (brand.startsWith(q) || business.startsWith(q)) return 800;
  if (brand.includes(q) || business.includes(q)) return 600;
  if (kwTerms.some((t: string) => t === q)) return 500;
  if (kwTerms.some((t: string) => t.includes(q))) return 420;
  if (category.includes(q) || cats.some((c) => c.includes(q))) return 350;
  if (about.includes(q)) return 100;
  return 0;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(q: string, type: string) {
    if (!q || q.trim().length < 2) {
      return { products: [], providers: [], categories: [] };
    }

    const query = q.trim();
    const qLower = query.toLowerCase();
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
              status: 'approved',
              ...activeProductWhere,
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
                { materials: { contains: query, mode: 'insensitive' } },
                { tags: { contains: query, mode: 'insensitive' } },
                { category: { contains: query, mode: 'insensitive' } },
                {
                  keywords: {
                    some: {
                      keyword: {
                        term: { contains: qLower, mode: 'insensitive' },
                      },
                    },
                  },
                },
              ],
            },
            include: { keywords: { include: { keyword: true } } },
            take: 40,
          })
        : Promise.resolve([]),
      includeProviders
        ? this.prisma.user.findMany({
            where: {
              roles: { some: { role: { name: 'artisan' } } },
              artisanProfile: { status: 'approved' },
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { phone: { contains: query, mode: 'insensitive' } },
                { email: { contains: query, mode: 'insensitive' } },
                {
                  artisanProfile: {
                    about: { contains: query, mode: 'insensitive' },
                  },
                },
                {
                  artisanProfile: {
                    brandName: { contains: query, mode: 'insensitive' },
                  },
                },
                {
                  artisanProfile: {
                    businessName: { contains: query, mode: 'insensitive' },
                  },
                },
                {
                  artisanProfile: {
                    description: { contains: query, mode: 'insensitive' },
                  },
                },
                {
                  artisanProfile: {
                    category: { contains: query, mode: 'insensitive' },
                  },
                },
                {
                  artisanProfile: {
                    keywords: {
                      some: {
                        keyword: {
                          term: { contains: qLower, mode: 'insensitive' },
                        },
                      },
                    },
                  },
                },
              ],
            } as any,
            include: {
              artisanProfile: {
                include: { keywords: { include: { keyword: true } } },
              },
            },
            take: 40,
          })
        : Promise.resolve([]),
    ]);

    const rankedProducts = (products as any[])
      .map((p) => ({ p, score: productRelevance(p, qLower) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(({ p }) => productToDto(p));

    const rankedProviders = (providers as any[])
      .map((u) => ({ u, score: providerRelevance(u, qLower) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(({ u }) => providerToDto(u, u.artisanProfile));

    return {
      products: rankedProducts,
      providers: rankedProviders,
      categories: includeCategories
        ? categories
            .filter(
              (c) =>
                c.id.includes(qLower) ||
                c.name.toLowerCase().includes(qLower),
            )
            .slice(0, 10)
        : [],
    };
  }
}
