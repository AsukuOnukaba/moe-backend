import { createHmac, timingSafeEqual } from 'crypto';

export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

/** Paystack signs the raw request body with HMAC SHA512 of the secret key. */
export function paystackSignature(rawBody: Buffer, secret: string): string {
  return createHmac('sha512', secret).update(rawBody).digest('hex');
}

export function paystackSignatureValid(
  rawBody: Buffer | undefined,
  header: string | undefined,
  secret: string,
): boolean {
  if (!rawBody || !header || !secret) return false;
  const expected = paystackSignature(rawBody, secret);
  return safeEqual(expected, header.trim());
}

/**
 * Flutterwave v3 Standard sends the dashboard secret hash in `verif-hash`.
 * It is a shared secret comparison, not an HMAC of the body.
 */
export function flutterwaveSignatureValid(
  header: string | undefined,
  secretHash: string,
): boolean {
  if (!header || !secretHash) return false;
  return safeEqual(header.trim(), secretHash.trim());
}
