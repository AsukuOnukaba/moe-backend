import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { paystackSignature } from './payment-signature';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';

type Attempt = {
  id: string;
  orderId: number;
  customerId: number;
  gateway: string;
  reference: string;
  amountMinor: number;
  currency: string;
  status: string;
  paymentUrl: string | null;
  accessCode: string | null;
  saveCard: boolean;
  cardOnly: boolean;
  providerStatus: string | null;
  failureReason: string | null;
  paidAt: Date | null;
  verifiedAt: Date | null;
  createdAt: Date;
};

function harness() {
  const attempts: Attempt[] = [];
  const events: { gateway: string; eventKey: string }[] = [];
  const orders = new Map<number, Record<string, unknown>>([
    [
      9,
      {
        id: 9,
        customerId: 3,
        price: 10000,
        currency: 'NGN',
        paymentStatus: 'unpaid',
        paymentMethod: 'paystack',
        paymentReference: null,
        status: 'pending',
      },
    ],
  ]);
  const apply = jest.fn(async (input: { orderId: number; outcome: string; reference: string }) => {
    const order = orders.get(input.orderId)!;
    if (order.paymentStatus === 'paid') {
      return { alreadyPaid: true, paymentStatus: 'paid', orderStatus: order.status };
    }
    if (input.outcome === 'paid') {
      order.paymentStatus = 'paid';
      order.status = 'confirmed';
      order.paymentReference = input.reference;
      return { alreadyPaid: false, paymentStatus: 'paid', orderStatus: 'confirmed' };
    }
    if (input.outcome === 'failed') {
      order.paymentStatus = 'failed';
      return { alreadyPaid: false, paymentStatus: 'failed', orderStatus: order.status };
    }
    return { alreadyPaid: false, paymentStatus: order.paymentStatus, orderStatus: order.status };
  });
  const gateway = {
    availability: () => ({ paystack: true, flutterwave: true, mode: 'test' as const }),
    initialize: jest.fn(async (input: {
      gateway: string;
      reference: string;
      amountMinor: number;
      amountMajor: number;
      currency: string;
      email: string;
      callbackUrl: string;
    }) => ({
      paymentUrl:
        input.gateway === 'paystack'
          ? `https://checkout.paystack.com/${input.reference}`
          : `https://checkout.flutterwave.com/v3/hosted/pay/${input.reference}`,
      accessCode: input.gateway === 'paystack' ? 'AC_test' : undefined,
    })),
    verify: jest.fn(),
    paystackSecret: () => 'sk_test_secret',
    flutterwaveWebhookHash: () => 'hash_test_value',
    frontendUrl: () => 'https://moe-africa-mvp.vercel.app',
    corsOrigins: () => 'http://localhost:8080,http://127.0.0.1:8080',
  };
  const prisma = {
    user: {
      findUnique: jest.fn(async () => ({ email: 'ada@example.com', name: 'Ada' })),
    },
    order: {
      findUnique: jest.fn(async ({ where }: { where: { id: number } }) => orders.get(where.id) ?? null),
    },
    paymentAttempt: {
      findUnique: jest.fn(async ({ where }: { where: { reference: string } }) =>
        attempts.find((attempt) => attempt.reference === where.reference) ?? null,
      ),
      findFirst: jest.fn(
        async ({ where }: { where: { orderId: number; gateway: string; status: string } }) =>
          attempts.find(
            (attempt) =>
              attempt.orderId === where.orderId &&
              attempt.gateway === where.gateway &&
              attempt.status === where.status,
          ) ?? null,
      ),
      create: jest.fn(async ({ data }: { data: Omit<Attempt, 'id' | 'createdAt' | 'paymentUrl' | 'accessCode' | 'providerStatus' | 'failureReason' | 'paidAt' | 'verifiedAt'> }) => {
        const row: Attempt = {
          id: `pa_${attempts.length + 1}`,
          createdAt: new Date(),
          paymentUrl: null,
          accessCode: null,
          providerStatus: null,
          failureReason: null,
          paidAt: null,
          verifiedAt: null,
          ...data,
        };
        attempts.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<Attempt> }) => {
        const row = attempts.find((attempt) => attempt.id === where.id);
        if (!row) throw new Error('missing attempt');
        Object.assign(row, data);
        return row;
      }),
    },
    paymentWebhookEvent: {
      create: jest.fn(async ({ data }: { data: { gateway: string; eventKey: string } }) => {
        if (events.some((event) => event.gateway === data.gateway && event.eventKey === data.eventKey)) {
          const err = new Error('Unique') as Error & { code: string };
          err.code = 'P2002';
          throw err;
        }
        events.push(data);
        return data;
      }),
    },
    paymentMethod: {
      findFirst: jest.fn(async () => null),
    },
  };
  const service = new PaymentsService(
    prisma as never,
    { applyVerifiedPayment: apply } as never,
    { createFromGateway: jest.fn() } as never,
    gateway as never,
  );
  const user: AccessTokenPayload = { sub: 3, email: 'ada@example.com', role: 'customer' };
  return { service, prisma, gateway, apply, attempts, orders, user };
}

describe('PaymentsService', () => {
  const origin = 'http://localhost:8080';

  it('charges the order total plus delivery and ignores the client amount, email, and callback', async () => {
    const { service, gateway, user } = harness();
    const started = await service.initialize(
      user,
      {
        orderId: '9',
        gateway: 'paystack',
        amount: 1,
        currency: 'USD',
        email: 'attacker@example.com',
        callbackUrl: 'https://evil.example/steal',
      },
      origin,
    );
    expect(gateway.initialize).toHaveBeenCalledTimes(1);
    const sent = gateway.initialize.mock.calls[0][0];
    expect(sent.amountMinor).toBe(1_250_000);
    expect(sent.amountMajor).toBe(12500);
    expect(sent.currency).toBe('NGN');
    expect(sent.email).toBe('ada@example.com');
    expect(sent.callbackUrl).toContain('http://localhost:8080/marketplace/payment/callback');
    expect(sent.callbackUrl).not.toContain('evil.example');
    if (!('paymentUrl' in started) || !started.paymentUrl) {
      throw new Error('expected a hosted checkout URL');
    }
    expect(started.paymentUrl).toContain('https://checkout.paystack.com/');
    expect(started.accessCode).toBe('AC_test');
  });

  it('reuses an open checkout when the button is clicked again', async () => {
    const { service, gateway, user } = harness();
    const first = await service.initialize(user, { orderId: '9', gateway: 'paystack' }, origin);
    const second = await service.initialize(user, { orderId: '9', gateway: 'paystack' }, origin);
    expect(gateway.initialize).toHaveBeenCalledTimes(1);
    expect(second.reference).toBe(first.reference);
  });

  it('does not start another charge for an order that is already paid', async () => {
    const { service, gateway, orders, user } = harness();
    orders.get(9)!.paymentStatus = 'paid';
    orders.get(9)!.paymentReference = 'moe-ps-9-paid';
    const started = await service.initialize(user, { orderId: '9', gateway: 'paystack' }, origin);
    expect(gateway.initialize).not.toHaveBeenCalled();
    expect(started).toMatchObject({ alreadyPaid: true, status: 'success', reference: 'moe-ps-9-paid' });
  });

  it('marks an order paid only when the provider confirms reference, amount, and currency', async () => {
    const { service, gateway, apply, attempts, user } = harness();
    const started = await service.initialize(user, { orderId: '9', gateway: 'paystack' }, origin);
    gateway.verify.mockResolvedValue({
      status: 'success',
      amountMinor: 1_250_000,
      currency: 'NGN',
      reference: started.reference,
      paidAt: '2026-10-31T12:00:00.000Z',
      card: null,
    });
    const verified = await service.verify(user, { reference: started.reference!, gateway: 'paystack' });
    expect(verified.status).toBe('success');
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'paid', reference: started.reference }));
    expect(attempts[0].status).toBe('success');
  });

  it('rejects a successful provider payload with the wrong amount or currency', async () => {
    const { service, gateway, apply, user, attempts } = harness();
    const started = await service.initialize(user, { orderId: '9', gateway: 'paystack' }, origin);
    gateway.verify.mockResolvedValue({
      status: 'success',
      amountMinor: 100,
      currency: 'NGN',
      reference: started.reference,
      paidAt: null,
      card: null,
    });
    const mismatch = await service.verify(user, { reference: started.reference!, gateway: 'paystack' });
    expect(mismatch.status).toBe('failed');
    expect(apply).not.toHaveBeenCalled();
    expect(attempts[0].failureReason).toBe('amount_mismatch');

    attempts[0].status = 'pending';
    gateway.verify.mockResolvedValue({
      status: 'success',
      amountMinor: 1_250_000,
      currency: 'USD',
      reference: started.reference,
      paidAt: null,
      card: null,
    });
    const currency = await service.verify(user, { reference: started.reference!, gateway: 'paystack' });
    expect(currency.status).toBe('failed');
    expect(apply).not.toHaveBeenCalled();
  });

  it('rejects a provider success for a different reference', async () => {
    const { service, gateway, apply, user } = harness();
    const started = await service.initialize(user, { orderId: '9', gateway: 'paystack' }, origin);
    gateway.verify.mockResolvedValue({
      status: 'success',
      amountMinor: 1_250_000,
      currency: 'NGN',
      reference: 'someone-elses-reference',
      paidAt: null,
      card: null,
    });
    const verified = await service.verify(user, { reference: started.reference!, gateway: 'paystack' });
    expect(verified.status).toBe('failed');
    expect(apply).not.toHaveBeenCalled();
  });

  it('records cancellation and failure without marking the order paid', async () => {
    const { service, gateway, apply, orders, user } = harness();
    const started = await service.initialize(user, { orderId: '9', gateway: 'paystack' }, origin);
    gateway.verify.mockResolvedValueOnce({
      status: 'cancelled',
      amountMinor: null,
      currency: null,
      reference: started.reference,
      paidAt: null,
      card: null,
    });
    const cancelled = await service.verify(user, { reference: started.reference!, gateway: 'paystack' });
    expect(cancelled.status).toBe('cancelled');
    expect(orders.get(9)!.paymentStatus).toBe('unpaid');

    const retry = await service.initialize(user, { orderId: '9', gateway: 'paystack' }, origin);
    gateway.verify.mockResolvedValueOnce({
      status: 'failed',
      amountMinor: 1_250_000,
      currency: 'NGN',
      reference: retry.reference,
      paidAt: null,
      card: null,
    });
    const failed = await service.verify(user, { reference: retry.reference!, gateway: 'paystack' });
    expect(failed.status).toBe('failed');
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'failed' }));
    expect(orders.get(9)!.paymentStatus).toBe('failed');
  });

  it('does not let another customer verify the payment', async () => {
    const { service, user } = harness();
    const started = await service.initialize(user, { orderId: '9', gateway: 'paystack' }, origin);
    const intruder: AccessTokenPayload = { sub: 8, email: 'intruder@example.com', role: 'customer' };
    await expect(
      service.verify(intruder, { reference: started.reference!, gateway: 'paystack' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a forged Paystack webhook and ignores a repeated event', async () => {
    const { service, gateway, apply, user } = harness();
    const started = await service.initialize(user, { orderId: '9', gateway: 'paystack' }, origin);
    const payload = Buffer.from(
      JSON.stringify({ event: 'charge.success', data: { id: 55, reference: started.reference } }),
    );
    await expect(service.handlePaystackWebhook(payload, 'forged-signature')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(apply).not.toHaveBeenCalled();

    gateway.verify.mockResolvedValue({
      status: 'success',
      amountMinor: 1_250_000,
      currency: 'NGN',
      reference: started.reference,
      paidAt: '2026-10-31T12:00:00.000Z',
      card: null,
    });
    const signature = paystackSignature(payload, 'sk_test_secret');
    await service.handlePaystackWebhook(payload, signature);
    await service.handlePaystackWebhook(payload, signature);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('rejects a forged Flutterwave webhook and verifies by tx_ref before paying', async () => {
    const { service, gateway, apply, orders, user } = harness();
    orders.get(9)!.paymentMethod = 'flutterwave';
    const started = await service.initialize(user, { orderId: '9', gateway: 'flutterwave' }, origin);
    const payload = Buffer.from(
      JSON.stringify({
        event: 'charge.completed',
        data: { tx_ref: started.reference, status: 'successful', amount: 1, currency: 'NGN' },
      }),
    );
    await expect(service.handleFlutterwaveWebhook(payload, 'forged')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    gateway.verify.mockResolvedValue({
      status: 'success',
      amountMinor: 1_250_000,
      currency: 'NGN',
      reference: started.reference,
      paidAt: null,
      card: null,
    });
    await service.handleFlutterwaveWebhook(payload, 'hash_test_value');
    expect(gateway.verify).toHaveBeenCalledWith('flutterwave', started.reference);
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'paid', gateway: 'flutterwave' }));
  });
});
