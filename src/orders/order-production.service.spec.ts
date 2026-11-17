import { OrderProductionService } from './order-production.service';

describe('OrderProductionService', () => {
  it('countdown uses persisted timestamps (not browser invent)', () => {
    const svc = new OrderProductionService({} as never, {} as never);
    const started = new Date('2026-11-17T10:00:00.000Z');
    const deadline = new Date('2026-11-20T10:00:00.000Z');
    const original = new Date('2026-11-19T10:00:00.000Z');
    const now = new Date('2026-11-18T10:00:00.000Z');
    const c = svc.countdownFields(
      {
        productionStartedAt: started,
        productionDeadline: deadline,
        productionOriginalDeadline: original,
        productionDurationDays: 3,
      },
      now,
    );
    expect(c?.productionStartedAt).toBe(started.toISOString());
    expect(c?.productionOriginalDeadline).toBe(original.toISOString());
    expect(c?.msElapsed).toBe(24 * 60 * 60 * 1000);
    expect(c?.msRemaining).toBe(2 * 24 * 60 * 60 * 1000);
    expect(c?.overdue).toBe(false);
  });

  it('marks overdue when now past deadline', () => {
    const svc = new OrderProductionService({} as never, {} as never);
    const c = svc.countdownFields(
      {
        productionStartedAt: new Date('2026-11-01T00:00:00.000Z'),
        productionDeadline: new Date('2026-11-02T00:00:00.000Z'),
        productionOriginalDeadline: new Date('2026-11-02T00:00:00.000Z'),
        productionDurationDays: 1,
      },
      new Date('2026-11-03T00:00:00.000Z'),
    );
    expect(c?.overdue).toBe(true);
    expect(c?.msRemaining).toBeLessThan(0);
  });
});
