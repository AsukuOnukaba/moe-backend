/** Admin capability strings for artisan payout finance actions. */
export const PAYOUT_CAPABILITIES = [
  'payout_amount_approve',
  'payout_transfer_record',
  'payout_transfer_verify',
  'payout_dispute',
  'payout_mark_not_required',
] as const;

export type PayoutCapability = (typeof PAYOUT_CAPABILITIES)[number];

export const PAYOUT_STATUSES = [
  'requested',
  'amount_approved',
  'recorded',
  'verified',
  'rejected',
  'disputed',
  'reversed',
  'not_required',
] as const;

export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export const TRANSFER_STATUSES = [
  'recorded',
  'verified',
  'rejected',
  'disputed',
  'reversed',
] as const;

export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

/**
 * Optional absolute max per currency for initial payout.
 * Do NOT invent a default percentage — leave unset until product approves a policy.
 * Example env INITIAL_PAYOUT_LIMITS_JSON={"NGN":{"maxAbsolute":50000}}
 */
export type PayoutLimitCurrencyRule = {
  maxAbsolute?: number | null;
  /** Only applied when explicitly configured — never invent a default. */
  maxRatio?: number | null;
};

export type PayoutLimitsConfig = Record<string, PayoutLimitCurrencyRule>;
