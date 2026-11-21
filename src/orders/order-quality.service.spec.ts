import { OrderQualityService } from './order-quality.service';

describe('OrderQualityService', () => {
  it('requires CUSTOMER_DELIVERY_REVIEW_HOURS for auto eligibility', async () => {
    const svc = new OrderQualityService(
      { order: { findMany: jest.fn() } } as never,
      {} as never,
      { get: () => undefined } as never,
    );
    const result = await svc.processCustomerReviewWindows(new Date());
    expect(result.policyConfigured).toBe(false);
    expect(result.eligible).toBe(0);
    expect(result.message).toMatch(/CUSTOMER_DELIVERY_REVIEW_HOURS/);
  });

  it('parses configured review hours', () => {
    const svc = new OrderQualityService(
      {} as never,
      {} as never,
      { get: (k: string) => (k === 'CUSTOMER_DELIVERY_REVIEW_HOURS' ? '72' : undefined) } as never,
    );
    expect(svc.customerReviewHours()).toBe(72);
  });

  it('escalates a disputed delivery after the configured window exactly once', async () => {
    const updateMany = jest.fn(async () => ({ count: 1 }));
    const createEvent = jest.fn(async () => ({}));
    const svc = new OrderQualityService(
      {
        order: {
          findMany: jest.fn(async () => [
            {
              id: 12,
              fulfillmentStatus: 'delivery_disputed',
              deliveredAt: new Date('2026-11-01T00:00:00Z'),
              customerReviewDeadline: new Date('2026-11-04T00:00:00Z'),
              disputes: [{ id: 'open-dispute' }],
              deliveryEvents: [],
            },
          ]),
          updateMany,
        },
        orderDeliveryEvent: { create: createEvent },
      } as never,
      {} as never,
      { get: () => '72' } as never,
    );

    const result = await svc.processCustomerReviewWindows(
      new Date('2026-11-05T00:00:00Z'),
    );
    expect(result.escalated).toBe(1);
    expect(result.eligible).toBe(0);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fulfillmentStatus: { in: ['delivered', 'delivery_disputed'] },
        }),
      }),
    );
    expect(createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'escalated' }),
      }),
    );
  });
});
