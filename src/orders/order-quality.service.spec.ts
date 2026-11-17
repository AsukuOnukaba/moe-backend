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
});
