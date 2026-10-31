import { buildPaymentCallbackUrl, resolveCallbackBase } from './payment-callback';

describe('payment callback URLs', () => {
  it('uses an allowlisted browser origin and ignores a forged callback', () => {
    const base = resolveCallbackBase({
      requestOrigin: 'http://localhost:8080',
      frontendUrl: 'https://moe-africa-mvp.vercel.app',
      corsOrigins: 'http://localhost:8080,http://127.0.0.1:8080',
    });
    expect(base).toBe('http://localhost:8080');
    expect(
      resolveCallbackBase({
        requestOrigin: 'https://evil.example',
        frontendUrl: 'https://moe-africa-mvp.vercel.app',
        corsOrigins: 'http://localhost:8080',
      }),
    ).toBe('https://moe-africa-mvp.vercel.app');
  });

  it('builds the storefront return URL with the gateway and reference', () => {
    const url = new URL(
      buildPaymentCallbackUrl({
        base: 'http://localhost:8080',
        gateway: 'flutterwave',
        orderId: 9,
        reference: 'moe-fw-9-abc',
      }),
    );
    expect(url.pathname).toBe('/marketplace/payment/callback');
    expect(url.searchParams.get('gateway')).toBe('flutterwave');
    expect(url.searchParams.get('orderId')).toBe('9');
    expect(url.searchParams.get('reference')).toBe('moe-fw-9-abc');
  });
});
