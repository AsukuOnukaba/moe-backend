/**
 * Unit tests for search ranking helpers via SearchService.search with mocked Prisma.
 */
import { SearchService } from './search.service';

describe('SearchService relevance ranking', () => {
  const prisma: any = {
    product: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
  };
  let service: SearchService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SearchService(prisma);
    prisma.user.findMany.mockResolvedValue([]);
  });

  it('ranks exact name above description match and omits relevanceScore', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Other item',
        description: 'beautiful ankara fabric',
        category: 'fashion',
        tags: '',
        materials: '',
        currency: 'NGN',
        price: 1000,
        keywords: [],
      },
      {
        id: 2,
        name: 'Ankara',
        description: 'dress',
        category: 'fashion',
        tags: '',
        materials: '',
        currency: 'NGN',
        price: 2000,
        keywords: [],
      },
      {
        id: 3,
        name: 'Wrap',
        description: 'x',
        category: 'fashion',
        tags: '',
        materials: '',
        currency: 'NGN',
        price: 1500,
        keywords: [{ keyword: { term: 'ankara' } }],
      },
    ]);

    const res = await service.search('ankara', 'products');
    expect(res.products.map((p: any) => p.id)).toEqual([2, 3, 1]);
    for (const p of res.products as any[]) {
      expect(p.relevanceScore).toBeUndefined();
    }
  });
});
