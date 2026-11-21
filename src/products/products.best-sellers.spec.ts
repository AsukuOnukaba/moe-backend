import { ProductsService } from './products.service';

describe('ProductsService Best Sellers ranking', () => {
  const candidates = [
    {
      id: 1,
      name: 'Curated Zero Sales',
      isBestSeller: false,
      price: 100,
      createdAt: new Date('2026-01-01'),
    },
    {
      id: 2,
      name: 'Real Seller',
      isBestSeller: false,
      price: 200,
      createdAt: new Date('2026-01-02'),
    },
    {
      id: 3,
      name: 'Flagged Seller',
      isBestSeller: true,
      price: 300,
      createdAt: new Date('2026-01-03'),
    },
  ];

  function buildService(opts?: {
    curated?: string[];
    grouped?: Array<{ productId: number; count: number }>;
  }) {
    const prisma = {
      product: { findMany: jest.fn().mockResolvedValue(candidates) },
      curatedSection: {
        findUnique: jest.fn().mockResolvedValue({
          isActive: true,
          items: (opts?.curated ?? ['1']).map((itemId, position) => ({
            itemId,
            position,
          })),
        }),
      },
      order: {
        groupBy: jest.fn().mockResolvedValue(
          (opts?.grouped ?? [{ productId: 2, count: 4 }]).map((row) => ({
            productId: row.productId,
            _count: { _all: row.count },
          })),
        ),
      },
    };
    return {
      service: new ProductsService(prisma as never, {} as never),
      prisma,
    };
  }

  it('includes a publicly eligible curated product with zero sales and preserves pin order', async () => {
    const { service } = buildService({ curated: ['3', '1'] });
    const result = await (
      service as unknown as {
        rankBestSellers: (
          where: object,
          sort: string,
        ) => Promise<{ ids: number[] }>;
      }
    ).rankBestSellers({ status: 'approved', deletedAt: null }, 'orders');

    expect(result.ids).toEqual([3, 1, 2]);
  });

  it('keeps genuine sales-ranked products and excludes products with no pin, flag or valid sales', async () => {
    const { service, prisma } = buildService({
      curated: [],
      grouped: [{ productId: 2, count: 2 }],
    });
    const result = await (
      service as unknown as {
        rankBestSellers: (
          where: object,
          sort: string,
        ) => Promise<{ ids: number[] }>;
      }
    ).rankBestSellers({ status: 'approved', deletedAt: null }, 'orders');

    expect(result.ids).toEqual([2, 3]);
    expect(prisma.order.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isTestOrder: false,
          status: { notIn: ['cancelled', 'rejected'] },
        }),
      }),
    );
  });

  it('applies an explicit customer sort to the same curated and ranked union', async () => {
    const { service } = buildService({ curated: ['1'] });
    const result = await (
      service as unknown as {
        rankBestSellers: (
          where: object,
          sort: string,
        ) => Promise<{ ids: number[] }>;
      }
    ).rankBestSellers({ status: 'approved', deletedAt: null }, 'price_desc');

    expect(result.ids).toEqual([3, 2, 1]);
  });
});
