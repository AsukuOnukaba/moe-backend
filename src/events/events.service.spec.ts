import { EventsService, DEMAND_THRESHOLDS } from './events.service';

describe('EventsService', () => {
  const prisma: any = {
    userBehaviourEvent: {
      findFirst: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  };
  let service: EventsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EventsService(prisma);
  });

  it('dedupes same session+event+entity within 5 minutes', async () => {
    prisma.userBehaviourEvent.findFirst.mockResolvedValue({ id: 1 });
    await service.track(
      {
        sessionId: 's1',
        eventType: 'product_view',
        entityType: 'product',
        entityId: '12',
      },
      null,
    );
    expect(prisma.userBehaviourEvent.create).not.toHaveBeenCalled();
  });

  it('creates event for anonymous user', async () => {
    prisma.userBehaviourEvent.findFirst.mockResolvedValue(null);
    await service.track(
      {
        sessionId: 's1',
        eventType: 'product_view',
        entityType: 'product',
        entityId: '12',
      },
      null,
    );
    expect(prisma.userBehaviourEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sessionId: 's1',
        eventType: 'product_view',
        userId: undefined,
      }),
    });
  });

  it('attaches authenticated userId', async () => {
    prisma.userBehaviourEvent.findFirst.mockResolvedValue(null);
    await service.track(
      { sessionId: 's1', eventType: 'search', metadata: { searchTerm: 'ankara' } },
      42,
    );
    expect(prisma.userBehaviourEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 42, eventType: 'search' }),
    });
  });

  it('computes product view stats and high demand', async () => {
    prisma.userBehaviourEvent.count
      .mockResolvedValueOnce(DEMAND_THRESHOLDS.viewsTodayHigh + 1)
      .mockResolvedValueOnce(10);
    const stats = await service.productViewStats(5);
    expect(stats.viewsToday).toBe(DEMAND_THRESHOLDS.viewsTodayHigh + 1);
    expect(stats.isHighDemand).toBe(true);
  });
});
