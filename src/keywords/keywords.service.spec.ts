import { KeywordsService } from './keywords.service';

describe('KeywordsService', () => {
  const tx = {
    productKeyword: { deleteMany: jest.fn(), create: jest.fn() },
    artisanKeyword: { deleteMany: jest.fn(), create: jest.fn() },
    keyword: { upsert: jest.fn() },
  };
  const prisma: any = {
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };

  let service: KeywordsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new KeywordsService(prisma);
    tx.keyword.upsert.mockImplementation(async ({ where }: any) => ({
      id: where.term.length,
      term: where.term,
    }));
  });

  it('normalizes, lowercases, and dedupes product keywords', async () => {
    await service.syncProductKeywords(9, [' Eid ', 'EID', 'graduation', '', '  ']);
    expect(tx.productKeyword.deleteMany).toHaveBeenCalledWith({
      where: { productId: 9 },
    });
    expect(tx.keyword.upsert).toHaveBeenCalledTimes(2);
    expect(tx.keyword.upsert.mock.calls.map((c: any) => c[0].where.term).sort()).toEqual([
      'eid',
      'graduation',
    ]);
  });

  it('no-ops when keywords undefined', async () => {
    await service.syncProductKeywords(1, undefined);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
