import { ArtisanPayoutService } from './artisan-payout.service';

describe('ArtisanPayoutService', () => {
  function build(opts: {
    prisma?: Record<string, unknown>;
    capabilities?: Record<string, unknown>;
    config?: Record<string, string | undefined>;
    notifications?: Record<string, unknown>;
  } = {}) {
    const configMap = opts.config ?? {};
    return new ArtisanPayoutService(
      (opts.prisma ?? {}) as never,
      (opts.notifications ?? {
        notifyArtisanPayoutVerified: jest.fn(),
        notifyProductionStarted: jest.fn(),
        notifyOrderStatusChange: jest.fn(),
      }) as never,
      (opts.capabilities ?? {
        assertCapability: jest.fn(async () => undefined),
        hasCapability: jest.fn(async () => true),
      }) as never,
      { get: (k: string) => configMap[k] } as never,
    );
  }

  it('reports missing limit policy without inventing a percentage', () => {
    const svc = build();
    const result = svc.evaluateLimit({
      orderPrice: 100_000,
      currency: 'NGN',
      approvedAmount: 10_000,
    });
    expect(result.policyStatus).toBe('missing');
    expect(result.withinLimit).toBe(false);
    expect(result.maxAllowed).toBeNull();
  });

  it('applies configured absolute limit only', () => {
    const svc = build({
      config: { INITIAL_PAYOUT_LIMITS_JSON: '{"NGN":{"maxAbsolute":20000}}' },
    });
    expect(
      svc.evaluateLimit({
        orderPrice: 100_000,
        currency: 'NGN',
        approvedAmount: 15_000,
      }).withinLimit,
    ).toBe(true);
    expect(
      svc.evaluateLimit({
        orderPrice: 100_000,
        currency: 'NGN',
        approvedAmount: 25_000,
      }),
    ).toMatchObject({
      withinLimit: false,
      policyStatus: 'exceeded_with_exception',
      maxAllowed: 20_000,
    });
  });

  it('blocks production start until Start Work authorised', async () => {
    const svc = build();
    await expect(
      svc.assertProductionStartAllowed({
        id: 1,
        readinessWorkflowStatus: 'approved',
        productionStartedAt: null,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'READINESS_PRODUCTION_BLOCKED' }),
    });
    await expect(
      svc.assertProductionStartAllowed({
        id: 2,
        readinessWorkflowStatus: null,
        productionStartedAt: null,
      }),
    ).resolves.toBeUndefined();
    await expect(
      svc.assertProductionStartAllowed({
        id: 3,
        readinessWorkflowStatus: 'approved',
        productionStartedAt: new Date(),
      }),
    ).resolves.toBeUndefined();
  });

  it('does not treat recorded-only funding as start-work eligible', async () => {
    const svc = build();
    const eligibility = await svc.evaluateStartWorkEligibility({
      id: 10,
      providerId: 5,
      status: 'confirmed',
      paymentStatus: 'paid',
      paymentMethod: 'bank_transfer',
      readinessWorkflowStatus: 'approved',
      productionStartedAt: null,
      productionDeadline: null,
      productionDurationDays: null,
      currency: 'NGN',
      artisanPayout: {
        status: 'recorded',
        fundingRequired: true,
        approvedAmount: 5000,
        currency: 'NGN',
        disputeFlag: false,
        transfers: [
          { amount: 5000, currency: 'NGN', status: 'recorded' },
        ],
      },
    });
    expect(eligibility).toMatchObject({
      eligible: false,
      code: 'PAYOUT_NOT_VERIFIED',
    });
  });

  it('rejects partial verified funding below approved amount', async () => {
    const svc = build();
    const eligibility = await svc.evaluateStartWorkEligibility({
      id: 11,
      providerId: 5,
      status: 'confirmed',
      paymentStatus: 'unpaid',
      paymentMethod: 'cod',
      readinessWorkflowStatus: 'approved',
      productionStartedAt: null,
      productionDeadline: null,
      productionDurationDays: null,
      currency: 'NGN',
      artisanPayout: {
        status: 'recorded',
        fundingRequired: true,
        approvedAmount: 10000,
        currency: 'NGN',
        disputeFlag: false,
        transfers: [
          { amount: 4000, currency: 'NGN', status: 'verified' },
        ],
      },
    });
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.code).toBe('PAYOUT_INSUFFICIENT');
  });

  it('allows start work when verified total meets approved amount', async () => {
    const svc = build();
    const eligibility = await svc.evaluateStartWorkEligibility({
      id: 12,
      providerId: 5,
      status: 'confirmed',
      paymentStatus: 'paid',
      paymentMethod: 'paystack',
      readinessWorkflowStatus: 'approved',
      productionStartedAt: null,
      productionDeadline: null,
      productionDurationDays: null,
      currency: 'NGN',
      artisanPayout: {
        status: 'verified',
        fundingRequired: true,
        approvedAmount: 8000,
        currency: 'NGN',
        disputeFlag: false,
        transfers: [
          { amount: 3000, currency: 'NGN', status: 'verified' },
          { amount: 5000, currency: 'NGN', status: 'verified' },
        ],
      },
    });
    expect(eligibility.eligible).toBe(true);
  });

  it('allows start work for audited funding-not-required path', async () => {
    const svc = build();
    const eligibility = await svc.evaluateStartWorkEligibility({
      id: 13,
      providerId: 5,
      status: 'confirmed',
      paymentStatus: 'paid',
      paymentMethod: 'card',
      readinessWorkflowStatus: 'approved',
      productionStartedAt: null,
      productionDeadline: null,
      productionDurationDays: null,
      currency: 'NGN',
      artisanPayout: {
        status: 'not_required',
        fundingRequired: false,
        approvedAmount: 0,
        currency: 'NGN',
        disputeFlag: false,
        transfers: [],
      },
    });
    expect(eligibility.eligible).toBe(true);
  });

  it('blocks start work when disputed before production', async () => {
    const svc = build();
    const eligibility = await svc.evaluateStartWorkEligibility({
      id: 14,
      providerId: 5,
      status: 'confirmed',
      paymentStatus: 'paid',
      paymentMethod: 'bank_transfer',
      readinessWorkflowStatus: 'approved',
      productionStartedAt: null,
      productionDeadline: null,
      productionDurationDays: null,
      currency: 'NGN',
      artisanPayout: {
        status: 'disputed',
        fundingRequired: true,
        approvedAmount: 5000,
        currency: 'NGN',
        disputeFlag: true,
        transfers: [
          { amount: 5000, currency: 'NGN', status: 'verified' },
        ],
      },
    });
    expect(eligibility).toMatchObject({
      eligible: false,
      code: 'PAYOUT_DISPUTED',
    });
  });

  it('rejects recorder verifying own transfer', async () => {
    const svc = build({
      prisma: {
        orderArtisanPayoutTransfer: {
          findFirst: jest.fn(async () => ({
            id: 9,
            status: 'recorded',
            recordedById: 42,
            evidence: [{ id: 1 }],
            payout: {
              id: 1,
              approvedAmount: 1000,
              currency: 'NGN',
              transfers: [],
            },
          })),
        },
      },
    });
    await expect(
      svc.verifyTransfer(
        { sub: 42, email: 'a@x.com', role: 'admin' },
        1,
        9,
        { notes: 'looks fine' },
        [],
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'RECORDER_CANNOT_VERIFY' }),
    });
  });

  it('startWork is idempotent once productionStartedAt is set', async () => {
    const started = new Date('2026-11-17T12:00:00.000Z');
    const deadline = new Date('2026-11-24T12:00:00.000Z');
    const svc = build({
      prisma: {
        order: {
          findUnique: jest.fn(async () => ({
            id: 20,
            providerId: 7,
            customerId: 3,
            productName: 'Gown',
            status: 'in_progress',
            readinessWorkflowStatus: 'approved',
            productionStartedAt: started,
            productionDeadline: deadline,
            artisanPayout: { id: 1, transfers: [] },
            readinessAssessments: [],
          })),
        },
      },
    });
    const result = await svc.startWork(
      { sub: 7, email: 'art@x.com', role: 'artisan' },
      20,
    );
    expect(result).toMatchObject({
      alreadyStarted: true,
      productionStartedAt: started.toISOString(),
      status: 'in_progress',
    });
  });
});
