import { OrderMilestoneService } from './order-milestone.service';

describe('OrderMilestoneService', () => {
  it('blocks milestone exceeding total payable without exception', async () => {
    const svc = new OrderMilestoneService(
      {
        orderArtisanPayout: {
          findUnique: jest.fn(async () => ({
            id: 1,
            currency: 'NGN',
            totalPayableAmount: 10000,
            milestones: [{ approvedAmount: 8000 }],
          })),
        },
      } as never,
      { assertCapability: jest.fn(async () => undefined) } as never,
    );
    await expect(
      svc.createMilestone(
        { sub: 1, email: 'a@x.com', role: 'admin' },
        9,
        {
          kind: 'intermediate',
          name: 'Mid',
          approvedAmount: 5000,
        },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'MILESTONE_TOTAL_EXCEEDED' }),
    });
  });

  it('blocks final milestone without quality/delivery eligibility', async () => {
    const svc = new OrderMilestoneService(
      {
        order: {
          findUnique: jest.fn(async () => ({
            id: 3,
            qualityReviewStatus: 'submitted',
            fulfillmentStatus: null,
            finalPayoutReviewEligible: false,
            artisanPayout: {
              status: 'requested',
              milestones: [{ id: 7, kind: 'final', status: 'planned' }],
            },
          })),
        },
        dispute: { count: jest.fn(async () => 0) },
      } as never,
      { assertCapability: jest.fn(async () => undefined) } as never,
    );
    await expect(
      svc.markMilestoneEligible(
        { sub: 1, email: 'a@x.com', role: 'admin' },
        3,
        7,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'FINAL_MILESTONE_NOT_ELIGIBLE' }),
    });
  });

  it('blocks a final milestone while an order dispute is open', async () => {
    const svc = new OrderMilestoneService(
      {
        order: {
          findUnique: jest.fn(async () => ({
            id: 3,
            qualityReviewStatus: 'approved',
            fulfillmentStatus: 'customer_accepted',
            finalPayoutReviewEligible: true,
            artisanPayout: {
              status: 'requested',
              milestones: [{ id: 7, kind: 'final', status: 'planned' }],
            },
          })),
        },
        dispute: { count: jest.fn(async () => 1) },
      } as never,
      { assertCapability: jest.fn(async () => undefined) } as never,
    );
    await expect(
      svc.markMilestoneEligible(
        { sub: 1, email: 'a@x.com', role: 'admin' },
        3,
        7,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'FINAL_MILESTONE_NOT_ELIGIBLE' }),
    });
  });
});
