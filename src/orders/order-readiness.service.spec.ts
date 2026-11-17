import { OrderReadinessService } from './order-readiness.service';
import {
  DEFAULT_HIGH_VALUE_THRESHOLD_NGN,
  READINESS_RESPONSE_HOURS,
} from './readiness.constants';

describe('OrderReadinessService', () => {
  const config = {
    get: (key: string) =>
      key === 'ORDER_HIGH_VALUE_THRESHOLD_NGN' ? '200000' : undefined,
  };

  function build(
    prisma: Record<string, unknown>,
    notifications: Record<string, unknown> = {},
    artisanPayouts: Record<string, unknown> = {
      ensurePayoutAfterReadinessApproval: jest.fn(async () => ({})),
      assertProductionStartAllowed: jest.fn(async (order: { readinessWorkflowStatus: string | null; productionStartedAt?: Date | null }) => {
        if (!order.readinessWorkflowStatus) return;
        if (order.productionStartedAt) return;
        throw new Error('Start Work is not available until admin readiness approval and confirmed initial artisan payout (Phase 2).');
      }),
    },
  ) {
    return new OrderReadinessService(
      prisma as never,
      notifications as never,
      config as never,
      artisanPayouts as never,
    );
  }

  it('uses configurable high-value threshold and custom/high-value for detailed type', () => {
    const svc = build({});
    expect(svc.highValueThresholdNgn()).toBe(200000);
    expect(
      svc.resolveAssessmentType({ isCustomOrder: true, price: 1000, currency: 'NGN' }),
    ).toBe('detailed');
    expect(
      svc.resolveAssessmentType({
        isCustomOrder: false,
        highValueOverride: true,
        price: 10,
        currency: 'NGN',
      }),
    ).toBe('detailed');
    expect(
      svc.resolveAssessmentType({
        isCustomOrder: false,
        price: 250000,
        currency: 'NGN',
      }),
    ).toBe('detailed');
    expect(
      svc.resolveAssessmentType({
        isCustomOrder: false,
        price: 1000,
        currency: 'NGN',
      }),
    ).toBe('standard');
  });

  it('falls back to default threshold when env unset', () => {
    const svc = new OrderReadinessService(
      {} as never,
      {} as never,
      { get: () => undefined } as never,
      {
        ensurePayoutAfterReadinessApproval: jest.fn(),
        assertProductionStartAllowed: jest.fn(),
      } as never,
    );
    expect(svc.highValueThresholdNgn()).toBe(DEFAULT_HIGH_VALUE_THRESHOLD_NGN);
  });

  it('blocks production start when readiness workflow is active', async () => {
    const svc = build({});
    await expect(
      svc.assertProductionStartAllowed({ id: 1, readinessWorkflowStatus: 'approved' }),
    ).rejects.toThrow(/Phase 2/);
    await expect(
      svc.assertProductionStartAllowed({ id: 2, readinessWorkflowStatus: null }),
    ).resolves.toBeUndefined();
  });

  it('assigns a 24h persistent deadline and notifies the artisan', async () => {
    const now = new Date('2026-11-17T10:00:00.000Z');
    const updates: unknown[] = [];
    const events: unknown[] = [];
    const prisma = {
      order: {
        update: jest.fn(async ({ data }: { data: unknown }) => {
          updates.push(data);
          return { id: 5, ...((data as object) ?? {}) };
        }),
      },
      orderReadinessEvent: {
        create: jest.fn(async ({ data }: { data: unknown }) => {
          events.push(data);
          return data;
        }),
      },
    };
    const notifications = {
      notifyReadinessAssigned: jest.fn(async () => ({})),
    };
    const svc = build(prisma, notifications);
    await svc.assignReadinessOnCreate(
      { id: 5, providerId: 9, productName: 'Ankara Set' },
      now,
    );
    const expectedDeadline = new Date(
      now.getTime() + READINESS_RESPONSE_HOURS * 60 * 60 * 1000,
    );
    expect(updates[0]).toMatchObject({
      readinessAssignedAt: now,
      readinessResponseDeadline: expectedDeadline,
      readinessWorkflowStatus: 'awaiting_response',
    });
    expect(notifications.notifyReadinessAssigned).toHaveBeenCalledWith(
      9,
      5,
      'Ankara Set',
      expectedDeadline,
    );
    expect(events[0]).toMatchObject({ action: 'assigned' });
  });

  it('processes 12h/20h reminders and overdue without cancelling', async () => {
    const assigned = new Date('2026-11-16T10:00:00.000Z');
    const deadline = new Date('2026-11-17T10:00:00.000Z');
    const order = {
      id: 7,
      providerId: 3,
      providerName: 'Ada Crafts',
      productName: 'Bag',
      readinessWorkflowStatus: 'awaiting_response',
      readinessAssignedAt: assigned,
      readinessResponseDeadline: deadline,
    };
    const reminderCreates: string[] = [];
    const prisma = {
      order: {
        findMany: jest.fn(async () => [{ ...order }]),
        update: jest.fn(async ({ data }: { data: { readinessWorkflowStatus: string } }) => ({
          ...order,
          ...data,
        })),
      },
      orderReadinessReminder: {
        create: jest.fn(async ({ data }: { data: { kind: string } }) => {
          if (reminderCreates.includes(data.kind)) {
            const err = new Error('unique') as Error & { code: string };
            err.code = 'P2002';
            throw err;
          }
          reminderCreates.push(data.kind);
          return data;
        }),
      },
      orderReadinessEvent: { create: jest.fn(async () => ({})) },
      user: {
        findMany: jest.fn(async () => [{ id: 1 }]),
      },
    };
    const notifications = {
      notifyReadinessReminder: jest.fn(async () => ({})),
      notifyReadinessOverdue: jest.fn(async () => ({})),
      notifyReadinessOverdueArtisan: jest.fn(async () => ({})),
    };
    const svc = build(prisma, notifications);

    // At 12h
    await svc.processDeadlines(new Date('2026-11-16T22:00:00.000Z'));
    expect(reminderCreates).toContain('reminder_12h');
    expect(notifications.notifyReadinessReminder).toHaveBeenCalled();

    // At 20h
    await svc.processDeadlines(new Date('2026-11-17T06:00:00.000Z'));
    expect(reminderCreates).toContain('reminder_20h');

    // Past deadline → overdue, no cancel
    const overdueResult = await svc.processDeadlines(
      new Date('2026-11-17T10:01:00.000Z'),
    );
    expect(overdueResult.overdue).toBe(1);
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { readinessWorkflowStatus: 'overdue' },
      }),
    );
    expect(notifications.notifyReadinessOverdue).toHaveBeenCalled();

    // Duplicate overdue is skipped
    const again = await svc.processDeadlines(new Date('2026-11-17T11:00:00.000Z'));
    expect(again.overdue).toBe(0);
  });

  it('extension records no automatic penalty', async () => {
    const events: Array<{ action: string; detail?: { penaltyApplied?: boolean } }> = [];
    const order = {
      id: 4,
      providerId: 2,
      productName: 'Item',
      readinessResponseDeadline: new Date('2026-11-17T10:00:00.000Z'),
      readinessWorkflowStatus: 'overdue',
    };
    const prisma = {
      order: {
        findUnique: jest.fn(async () => order),
        update: jest.fn(async ({ data }: { data: unknown }) => ({
          ...order,
          ...(data as object),
        })),
      },
      orderReadinessEvent: {
        create: jest.fn(async ({ data }: { data: (typeof events)[number] }) => {
          events.push(data);
          return data;
        }),
      },
    };
    const notifications = {
      notifyReadinessDeadlineExtended: jest.fn(async () => ({})),
    };
    const svc = build(prisma, notifications);
    const result = await svc.extendDeadline(
      { sub: 1, role: 'admin', email: 'a@moe.test' } as never,
      4,
      { extraHours: 6, reason: 'Supplier delay' },
    );
    expect(result.penaltyApplied).toBe(false);
    expect(events[0]?.detail?.penaltyApplied).toBe(false);
    expect(result.workflowStatus).toBe('awaiting_response');
  });
});
