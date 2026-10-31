const CALLBACK_PATH = '/marketplace/payment/callback';

function originOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value.trim()).origin;
  } catch {
    return null;
  }
}

export function allowedFrontendOrigins(input: {
  frontendUrl?: string;
  corsOrigins?: string;
}): Set<string> {
  const allowed = new Set<string>();
  const frontend = originOf(input.frontendUrl);
  if (frontend) allowed.add(frontend);
  for (const part of (input.corsOrigins ?? '').split(',')) {
    const origin = originOf(part);
    if (origin) allowed.add(origin);
  }
  return allowed;
}

export function resolveCallbackBase(input: {
  requestOrigin?: string;
  frontendUrl?: string;
  corsOrigins?: string;
}): string {
  const allowed = allowedFrontendOrigins(input);
  const requested = originOf(input.requestOrigin);
  if (requested && allowed.has(requested)) return requested;
  const frontend = originOf(input.frontendUrl);
  if (frontend) return frontend;
  return 'http://localhost:8080';
}

export function buildPaymentCallbackUrl(input: {
  base: string;
  gateway: 'paystack' | 'flutterwave';
  orderId: number;
  reference: string;
}): string {
  const url = new URL(CALLBACK_PATH, input.base);
  url.searchParams.set('gateway', input.gateway);
  url.searchParams.set('orderId', String(input.orderId));
  url.searchParams.set('reference', input.reference);
  return url.toString();
}
