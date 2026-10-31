const SUBUNITS: Record<string, number> = {
  NGN: 100,
  GHS: 100,
  KES: 100,
  ZAR: 100,
  USD: 100,
  GBP: 100,
  EUR: 100,
};

export function roundMajor(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function subunitFactor(currency: string): number | null {
  return SUBUNITS[currency.toUpperCase()] ?? null;
}

export function toMinorUnits(major: number, currency: string): number {
  const factor = subunitFactor(currency);
  if (!factor) {
    throw new Error(`Unsupported currency: ${currency}`);
  }
  const minor = Math.round(roundMajor(major) * factor);
  if (!Number.isSafeInteger(minor) || minor <= 0 || minor > 2_000_000_000) {
    throw new Error('Payment amount is outside the supported range');
  }
  return minor;
}

export function majorFromMinor(minor: number, currency: string): number {
  const factor = subunitFactor(currency);
  if (!factor) {
    throw new Error(`Unsupported currency: ${currency}`);
  }
  return roundMajor(minor / factor);
}
