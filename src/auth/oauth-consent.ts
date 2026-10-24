import { BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';

export const CONSENT_REQUIRED =
  'You must agree to the Terms of Service and Privacy Policy';

const TICKET_TTL_MS = 10 * 60 * 1000;
const tickets = new Map<string, number>();

/** One-time proof that this signup affirmed the existing Terms and Privacy Policy. */
export function issueOAuthConsentTicket(acceptedTerms: unknown): { state: string } {
  if (acceptedTerms !== true) {
    throw new BadRequestException({
      message: CONSENT_REQUIRED,
      code: 'VALIDATION_ERROR',
    });
  }
  const state = randomBytes(24).toString('hex');
  tickets.set(state, Date.now() + TICKET_TTL_MS);
  return { state };
}

/** True only the first time a live ticket is presented. Sign-in does not call this. */
export function consumeOAuthConsentTicket(state: unknown): boolean {
  if (typeof state !== 'string' || state.length === 0) return false;
  const expiresAt = tickets.get(state);
  tickets.delete(state);
  return typeof expiresAt === 'number' && expiresAt > Date.now();
}

/** Clerk copies this from the signup redirect. Existing accounts do not need it. */
export function clerkSignupAcceptedTerms(metadata: unknown): boolean {
  const meta = (metadata ?? {}) as { acceptedTerms?: unknown };
  return meta.acceptedTerms === true;
}
