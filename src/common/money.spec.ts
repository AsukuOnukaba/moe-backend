import { roundMajor, toMinorUnits } from './money';
import { chargeForOrder } from '../payments/payment-amount';

describe('payment amounts', () => {
  it('converts naira to kobo and adds the checkout delivery fee', () => {
    const charge = chargeForOrder({ price: 10000, currency: 'ngn' });
    expect(charge.merchandiseMajor).toBe(10000);
    expect(charge.deliveryMajor).toBe(2500);
    expect(charge.amountMajor).toBe(12500);
    expect(charge.amountMinor).toBe(1_250_000);
    expect(charge.currency).toBe('NGN');
  });

  it('rejects a zero order total', () => {
    expect(() => chargeForOrder({ price: 0, currency: 'NGN' })).toThrow(/not payable/);
  });

  it('rounds major units before converting', () => {
    expect(roundMajor(10.005)).toBe(10.01);
    expect(toMinorUnits(10.005, 'USD')).toBe(1001);
  });
});
