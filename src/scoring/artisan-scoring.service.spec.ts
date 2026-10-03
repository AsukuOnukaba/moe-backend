import { ArtisanScoringService, NEUTRAL_SCORE } from './artisan-scoring.service';

describe('ArtisanScoringService', () => {
  const prisma: any = {
    artisanProfile: { findUnique: jest.fn(), findMany: jest.fn() },
    order: { findMany: jest.fn() },
    conversation: { findMany: jest.fn() },
    artisanReview: { aggregate: jest.fn() },
    product: { count: jest.fn() },
    artisanScore: { upsert: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
  };

  let service: ArtisanScoringService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ArtisanScoringService(prisma);
    prisma.artisanProfile.findUnique.mockResolvedValue({
      userId: 1,
      updatedAt: new Date('2020-01-01'),
      createdAt: new Date('2020-01-01'),
    });
    prisma.product.count.mockResolvedValue(0);
    prisma.artisanReview.aggregate.mockResolvedValue({
      _avg: { rating: null },
      _count: { _all: 0 },
    });
    prisma.artisanScore.upsert.mockImplementation(async ({ create }: any) => ({
      artisanId: 1,
      ...create,
      lastCalculatedAt: new Date(),
    }));
  });

  it('uses neutral response score when no customer→provider pairs', async () => {
    prisma.order.findMany.mockResolvedValue([
      { status: 'delivered' },
      { status: 'delivered' },
      { status: 'cancelled' },
    ]);
    prisma.conversation.findMany.mockResolvedValue([]);

    const score = await service.calculateScore(1);

    expect(score.avgResponseTimeHrs).toBeNull();
    expect(score.orderCompletionRate).toBeCloseTo((2 / 3) * 100, 5);
    expect(score.reviewQualityScore).toBe(NEUTRAL_SCORE);
    const expectedComposite =
      score.orderCompletionRate * 0.35 +
      NEUTRAL_SCORE * 0.3 +
      score.activityScore * 0.2 +
      NEUTRAL_SCORE * 0.15;
    expect(score.compositeScore).toBeCloseTo(expectedComposite, 5);
  });

  it('ignores in-flight orders for completion rate', async () => {
    // Service only queries terminal statuses; simulate that filter result.
    prisma.order.findMany.mockResolvedValue([
      { status: 'delivered' },
      { status: 'rejected' },
    ]);
    prisma.conversation.findMany.mockResolvedValue([]);
    prisma.artisanReview.aggregate.mockResolvedValue({
      _avg: { rating: 5 },
      _count: { _all: 1 },
    });

    const score = await service.calculateScore(1);
    expect(score.orderCompletionRate).toBe(50);
    expect(score.reviewQualityScore).toBe(100);
  });

  it('computes avgResponseTimeHrs from first provider reply', async () => {
    prisma.order.findMany.mockResolvedValue([{ status: 'delivered' }]);
    const t0 = new Date('2026-01-01T10:00:00Z');
    const t1 = new Date('2026-01-01T12:00:00Z');
    prisma.conversation.findMany.mockResolvedValue([
      {
        messages: [
          { senderType: 'customer', sentAt: t0 },
          { senderType: 'provider', sentAt: t1 },
        ],
      },
    ]);

    const score = await service.calculateScore(1);
    expect(score.avgResponseTimeHrs).toBeCloseTo(2, 5);
  });

  it('recalculateAll skips concurrent runs', async () => {
    prisma.artisanProfile.findMany.mockResolvedValue([{ userId: 1 }]);
    prisma.order.findMany.mockResolvedValue([]);
    prisma.conversation.findMany.mockResolvedValue([]);

    const first = service.recalculateAll();
    const second = await service.recalculateAll();
    expect(second.processed).toBe(0);
    await first;
  });
});
