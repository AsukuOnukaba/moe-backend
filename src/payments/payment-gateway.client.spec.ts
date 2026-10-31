import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentGatewayClient } from './payment-gateway.client';

function client(values: Record<string, string>) {
  const config = {
    get: (key: string) => values[key],
  } as ConfigService;
  return new PaymentGatewayClient(config);
}

const initInput = {
  reference: 'moe-ps-9-abc',
  email: 'ada@example.com',
  customerName: 'Ada',
  amountMinor: 1_250_000,
  amountMajor: 12500,
  currency: 'NGN',
  callbackUrl: 'http://localhost:8080/marketplace/payment/callback?gateway=paystack',
  orderId: 9,
  cardOnly: true,
};

describe('PaymentGatewayClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('refuses a live Paystack key while test mode is the default', async () => {
    const gateway = client({ PAYSTACK_SECRET_KEY: 'sk_live_secret', PAYMENT_MODE: 'test' });
    await expect(gateway.initialize({ ...initInput, gateway: 'paystack' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('sends Paystack the minor-unit amount and Flutterwave the major-unit amount', async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (String(url).includes('paystack')) {
        return {
          ok: true,
          json: async () => ({
            status: true,
            data: { authorization_url: 'https://checkout.paystack.com/abc', access_code: 'AC' },
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({ status: 'success', data: { link: 'https://checkout.flutterwave.com/v3/hosted/pay/abc' } }),
      };
    }) as unknown as typeof fetch;

    const gateway = client({
      PAYSTACK_SECRET_KEY: 'sk_test_secret',
      FLUTTERWAVE_SECRET_KEY: 'FLWSECK_TEST-secret',
      PAYMENT_MODE: 'test',
    });
    await gateway.initialize({ ...initInput, gateway: 'paystack' });
    await gateway.initialize({ ...initInput, gateway: 'flutterwave', reference: 'moe-fw-9-abc' });

    const fetchMock = global.fetch as jest.Mock;
    const paystackBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.paystack.co/transaction/initialize');
    expect(paystackBody.amount).toBe(1_250_000);
    expect(paystackBody.channels).toEqual(['card']);
    expect(paystackBody.email).toBe('ada@example.com');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer sk_test_secret');

    const flutterwaveBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.flutterwave.com/v3/payments');
    expect(flutterwaveBody.amount).toBe(12500);
    expect(flutterwaveBody.tx_ref).toBe('moe-fw-9-abc');
    expect(flutterwaveBody.payment_options).toBe('card');
    expect(flutterwaveBody.subaccounts).toBeUndefined();
  });

  it('keeps live charges disabled unless live mode is explicitly enabled', () => {
    const blocked = client({
      PAYSTACK_SECRET_KEY: 'sk_live_secret',
      PAYMENT_MODE: 'live',
      PAYMENT_LIVE_ENABLED: 'false',
    });
    expect(blocked.availability().paystack).toBe(false);
    const open = client({
      PAYSTACK_SECRET_KEY: 'sk_test_secret',
      FLUTTERWAVE_SECRET_KEY: 'FLWSECK_TEST-secret',
    });
    expect(open.availability()).toMatchObject({ paystack: true, flutterwave: true, mode: 'test' });
  });
});
