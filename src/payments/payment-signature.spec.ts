import { createHmac } from 'crypto';
import {
  flutterwaveSignatureValid,
  paystackSignature,
  paystackSignatureValid,
} from './payment-signature';

describe('payment signatures', () => {
  const secret = 'sk_test_example_secret';
  const raw = Buffer.from('{"event":"charge.success","data":{"reference":"moe-ps-1-abc"}}');

  it('accepts a Paystack HMAC SHA512 of the raw body', () => {
    const signature = paystackSignature(raw, secret);
    expect(signature).toBe(createHmac('sha512', secret).update(raw).digest('hex'));
    expect(paystackSignatureValid(raw, signature, secret)).toBe(true);
  });

  it('rejects a forged Paystack signature and a missing body', () => {
    expect(paystackSignatureValid(raw, 'deadbeef', secret)).toBe(false);
    expect(paystackSignatureValid(undefined, paystackSignature(raw, secret), secret)).toBe(false);
  });

  it('accepts only the Flutterwave verif-hash secret', () => {
    expect(flutterwaveSignatureValid('hash_test_value', 'hash_test_value')).toBe(true);
    expect(flutterwaveSignatureValid('forged', 'hash_test_value')).toBe(false);
    expect(flutterwaveSignatureValid(undefined, 'hash_test_value')).toBe(false);
  });
});
