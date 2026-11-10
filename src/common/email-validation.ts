import { promises as dns } from 'dns';
import { BadRequestException } from '@nestjs/common';

/** Conservative address shape — mirrors typical mailbox local-part + domain rules. */
const EMAIL_FORMAT =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

const MX_LOOKUP_TIMEOUT_MS = 2_500;

const TRANSIENT_DNS_CODES = new Set([
  'ETIMEOUT',
  'ESERVFAIL',
  'ECONNREFUSED',
  'ENETUNREACH',
  'EAI_AGAIN',
]);

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmailFormat(email: string): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized || normalized.length > 254) return false;
  const at = normalized.lastIndexOf('@');
  if (at < 1 || at === normalized.length - 1) return false;
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (local.length > 64 || domain.includes('..')) return false;
  return EMAIL_FORMAT.test(normalized);
}

export function emailDomain(email: string): string | null {
  const normalized = normalizeEmail(email);
  const at = normalized.lastIndexOf('@');
  if (at < 1) return null;
  return normalized.slice(at + 1);
}

function dnsCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    return String((err as { code?: string }).code ?? '');
  }
  return '';
}

/**
 * Resolves MX records with a short timeout.
 * - no records / NXDOMAIN → undeliverable
 * - timeout / SERVFAIL / network → `transient` (caller must allow signup)
 */
export async function lookupMxStatus(
  domain: string,
): Promise<'ok' | 'none' | 'transient'> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const records = await Promise.race([
      dns.resolveMx(domain),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          const err = new Error('MX lookup timed out') as Error & { code: string };
          err.code = 'ETIMEOUT';
          reject(err);
        }, MX_LOOKUP_TIMEOUT_MS);
      }),
    ]);
    if (!Array.isArray(records) || records.length === 0) return 'none';
    return 'ok';
  } catch (err) {
    const code = dnsCode(err);
    if (code === 'ENOTFOUND' || code === 'ENODATA' || code === 'ESDOM') {
      return 'none';
    }
    // Node often surfaces NXDOMAIN as ENOTFOUND; some platforms use `queryMx ENOTFOUND`.
    if (/not\s*found|nxdomain|no\s*data/i.test(String((err as Error)?.message ?? ''))) {
      return 'none';
    }
    if (TRANSIENT_DNS_CODES.has(code) || !code) return 'transient';
    return 'transient';
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export type DeliverableEmailResult =
  | { ok: true; email: string; mx: 'ok' | 'skipped' | 'transient' }
  | { ok: false; email: string; reason: 'format' | 'mx' };

/**
 * Format + MX gate for signup. Temporary DNS failures do not block registration.
 */
export async function assertDeliverableEmail(
  rawEmail: string,
): Promise<{ email: string; mx: 'ok' | 'skipped' | 'transient' }> {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmailFormat(email)) {
    throw new BadRequestException({
      message: 'Enter a valid email address',
      code: 'VALIDATION_ERROR',
      errors: { email: ['Enter a valid email address'] },
    });
  }

  const domain = emailDomain(email);
  if (!domain) {
    throw new BadRequestException({
      message: 'Enter a valid email address',
      code: 'VALIDATION_ERROR',
      errors: { email: ['Enter a valid email address'] },
    });
  }

  // Skip live DNS for local/test domains used in harnesses.
  if (domain === 'localhost' || domain.endsWith('.test') || domain.endsWith('.local')) {
    return { email, mx: 'skipped' };
  }

  const mx = await lookupMxStatus(domain);
  if (mx === 'none') {
    throw new BadRequestException({
      message: 'This email domain cannot receive mail. Check for a typo and try again.',
      code: 'VALIDATION_ERROR',
      errors: {
        email: [
          'This email domain cannot receive mail. Check for a typo and try again.',
        ],
      },
    });
  }

  return { email, mx: mx === 'ok' ? 'ok' : 'transient' };
}
