import {
  BadRequestException,
  BadGatewayException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { majorFromMinor, toMinorUnits } from '../common/money';

export type PaymentGatewayName = 'paystack' | 'flutterwave';

export type GatewayCard = {
  token: string;
  brand: string;
  last4: string;
  expiry: string;
  reusable: boolean;
};

export type GatewayVerifyResult = {
  status: 'success' | 'failed' | 'cancelled' | 'pending';
  amountMinor: number | null;
  currency: string | null;
  reference: string | null;
  paidAt: string | null;
  card: GatewayCard | null;
};

const PAYSTACK_API = 'https://api.paystack.co';
const FLUTTERWAVE_API = 'https://api.flutterwave.com/v3';

@Injectable()
export class PaymentGatewayClient {
  private readonly logger = new Logger(PaymentGatewayClient.name);

  constructor(private readonly config: ConfigService) {}

  mode(): 'test' | 'live' {
    return this.read('PAYMENT_MODE') === 'live' ? 'live' : 'test';
  }

  liveEnabled(): boolean {
    return this.read('PAYMENT_LIVE_ENABLED') === 'true';
  }

  availability(): { paystack: boolean; flutterwave: boolean; mode: 'test' | 'live' } {
    return {
      paystack: this.configured('paystack'),
      flutterwave: this.configured('flutterwave'),
      mode: this.mode(),
    };
  }

  configured(gateway: PaymentGatewayName): boolean {
    try {
      this.secret(gateway);
      return true;
    } catch {
      return false;
    }
  }

  paystackSecret(): string {
    return this.secret('paystack');
  }

  flutterwaveWebhookHash(): string {
    return this.read('FLUTTERWAVE_WEBHOOK_HASH');
  }

  frontendUrl(): string {
    return this.read('FRONTEND_URL');
  }

  corsOrigins(): string {
    return this.read('CORS_ORIGINS');
  }

  async initialize(input: {
    gateway: PaymentGatewayName;
    reference: string;
    email: string;
    customerName: string;
    amountMinor: number;
    amountMajor: number;
    currency: string;
    callbackUrl: string;
    orderId: number;
    cardOnly: boolean;
  }): Promise<{ paymentUrl: string; accessCode?: string }> {
    if (input.gateway === 'paystack') {
      return this.initializePaystack(input);
    }
    return this.initializeFlutterwave(input);
  }

  async verify(
    gateway: PaymentGatewayName,
    reference: string,
  ): Promise<GatewayVerifyResult> {
    if (gateway === 'paystack') return this.verifyPaystack(reference);
    return this.verifyFlutterwave(reference);
  }

  private async initializePaystack(input: {
    reference: string;
    email: string;
    amountMinor: number;
    currency: string;
    callbackUrl: string;
    orderId: number;
    cardOnly: boolean;
  }): Promise<{ paymentUrl: string; accessCode?: string }> {
    const body = await this.postJson(
      `${PAYSTACK_API}/transaction/initialize`,
      this.secret('paystack'),
      {
        email: input.email,
        amount: input.amountMinor,
        currency: input.currency,
        reference: input.reference,
        callback_url: input.callbackUrl,
        channels: input.cardOnly
          ? ['card']
          : ['card', 'bank', 'ussd', 'bank_transfer', 'mobile_money'],
        metadata: { orderId: input.orderId, cancel_action: input.callbackUrl },
      },
    );
    const data = asRecord(body.data);
    const paymentUrl = typeof data?.authorization_url === 'string' ? data.authorization_url : '';
    const accessCode = typeof data?.access_code === 'string' ? data.access_code : undefined;
    if (!paymentUrl.startsWith('https://')) {
      throw new BadGatewayException({
        message: 'Paystack did not return a checkout link',
        code: 'PAYMENT_PROVIDER_ERROR',
      });
    }
    return { paymentUrl, accessCode };
  }

  private async initializeFlutterwave(input: {
    reference: string;
    email: string;
    customerName: string;
    amountMajor: number;
    currency: string;
    callbackUrl: string;
    orderId: number;
    cardOnly: boolean;
  }): Promise<{ paymentUrl: string; accessCode?: string }> {
    const payload: Record<string, unknown> = {
      tx_ref: input.reference,
      amount: input.amountMajor,
      currency: input.currency,
      redirect_url: input.callbackUrl,
      customer: { email: input.email, name: input.customerName },
      customizations: {
        title: 'MOE Africa',
        description: `Order ${input.orderId}`,
      },
      meta: { orderId: input.orderId },
    };
    if (input.cardOnly) payload.payment_options = 'card';
    const body = await this.postJson(`${FLUTTERWAVE_API}/payments`, this.secret('flutterwave'), payload);
    const data = asRecord(body.data);
    const paymentUrl = typeof data?.link === 'string' ? data.link : '';
    if (!paymentUrl.startsWith('https://')) {
      throw new BadGatewayException({
        message: 'Flutterwave did not return a checkout link',
        code: 'PAYMENT_PROVIDER_ERROR',
      });
    }
    return { paymentUrl };
  }

  private async verifyPaystack(reference: string): Promise<GatewayVerifyResult> {
    const body = await this.getJson(
      `${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`,
      this.secret('paystack'),
    );
    const data = asRecord(body.data);
    if (!data) {
      return pendingResult();
    }
    const status = mapPaystackStatus(typeof data.status === 'string' ? data.status : '');
    const currency = typeof data.currency === 'string' ? data.currency.toUpperCase() : null;
    const amountMinor = typeof data.amount === 'number' ? data.amount : null;
    return {
      status,
      amountMinor,
      currency,
      reference: typeof data.reference === 'string' ? data.reference : null,
      paidAt: typeof data.paid_at === 'string' ? data.paid_at : null,
      card: paystackCard(data.authorization),
    };
  }

  private async verifyFlutterwave(reference: string): Promise<GatewayVerifyResult> {
    const body = await this.getJson(
      `${FLUTTERWAVE_API}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
      this.secret('flutterwave'),
    );
    const data = asRecord(body.data);
    if (!data || body.status !== 'success') {
      return pendingResult();
    }
    const status = mapFlutterwaveStatus(typeof data.status === 'string' ? data.status : '');
    const currency = typeof data.currency === 'string' ? data.currency.toUpperCase() : null;
    let amountMinor: number | null = null;
    if (typeof data.amount === 'number' && currency) {
      try {
        amountMinor = toMinorUnits(data.amount, currency);
      } catch {
        amountMinor = null;
      }
    }
    return {
      status,
      amountMinor,
      currency,
      reference: typeof data.tx_ref === 'string' ? data.tx_ref : null,
      paidAt: typeof data.created_at === 'string' ? data.created_at : null,
      card: flutterwaveCard(data.card),
    };
  }

  private secret(gateway: PaymentGatewayName): string {
    const key = gateway === 'paystack' ? 'PAYSTACK_SECRET_KEY' : 'FLUTTERWAVE_SECRET_KEY';
    const secret = this.read(key);
    if (!secret) {
      throw new BadRequestException({
        message: `${gateway === 'paystack' ? 'Paystack' : 'Flutterwave'} is not configured`,
        code: 'PAYMENT_NOT_CONFIGURED',
      });
    }
    const mode = this.mode();
    if (mode === 'live' && !this.liveEnabled()) {
      throw new BadRequestException({
        message: 'Live payments are disabled',
        code: 'LIVE_PAYMENTS_DISABLED',
      });
    }
    if (!keyMatchesMode(gateway, secret, mode)) {
      throw new BadRequestException({
        message: `${gateway === 'paystack' ? 'Paystack' : 'Flutterwave'} key does not match ${mode} mode`,
        code: 'PAYMENT_NOT_CONFIGURED',
      });
    }
    return secret;
  }

  private read(key: string): string {
    const value = this.config.get<string>(key);
    return typeof value === 'string' ? value.trim() : '';
  }

  private async postJson(url: string, secret: string, payload: Record<string, unknown>) {
    return this.requestJson(url, secret, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  private async getJson(url: string, secret: string) {
    return this.requestJson(url, secret, { method: 'GET' });
  }

  private async requestJson(
    url: string,
    secret: string,
    init: { method: 'GET' | 'POST'; body?: string },
  ): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: init.method,
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/json',
        },
        body: init.body,
      });
    } catch {
      this.logger.warn(`Payment provider request failed (${statusHost(url)})`);
      throw new BadGatewayException({
        message: 'Payment provider could not be reached',
        code: 'PAYMENT_PROVIDER_ERROR',
      });
    }
    if (!response.ok) {
      this.logger.warn(
        `Payment provider rejected ${init.method} ${statusHost(url)} with status ${response.status}`,
      );
      throw new BadGatewayException({
        message: 'Payment provider could not complete the request',
        code: 'PAYMENT_PROVIDER_ERROR',
      });
    }
    try {
      return (await response.json()) as Record<string, unknown>;
    } catch {
      throw new BadGatewayException({
        message: 'Payment provider returned an unreadable response',
        code: 'PAYMENT_PROVIDER_ERROR',
      });
    }
  }
}

function statusHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'payment-provider';
  }
}

function keyMatchesMode(
  gateway: PaymentGatewayName,
  secret: string,
  mode: 'test' | 'live',
): boolean {
  if (gateway === 'paystack') {
    return mode === 'test' ? secret.startsWith('sk_test_') : secret.startsWith('sk_live_');
  }
  const testKey = /TEST/i.test(secret);
  return mode === 'test' ? testKey : !testKey && secret.startsWith('FLWSECK');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function pendingResult(): GatewayVerifyResult {
  return {
    status: 'pending',
    amountMinor: null,
    currency: null,
    reference: null,
    paidAt: null,
    card: null,
  };
}

function mapPaystackStatus(status: string): GatewayVerifyResult['status'] {
  const value = status.toLowerCase();
  if (value === 'success') return 'success';
  if (value === 'abandoned' || value === 'cancelled' || value === 'canceled') return 'cancelled';
  if (value === 'failed' || value === 'reversed') return 'failed';
  return 'pending';
}

function mapFlutterwaveStatus(status: string): GatewayVerifyResult['status'] {
  const value = status.toLowerCase();
  if (value === 'successful' || value === 'success') return 'success';
  if (value === 'cancelled' || value === 'canceled') return 'cancelled';
  if (value === 'failed') return 'failed';
  return 'pending';
}

function formatExpiry(month: string, year: string): string | null {
  if (!/^\d{1,2}$/.test(month) || !/^\d{2,4}$/.test(year)) return null;
  const mm = month.padStart(2, '0');
  const monthNumber = Number(mm);
  if (monthNumber < 1 || monthNumber > 12) return null;
  const yy = year.length === 4 ? year.slice(-2) : year;
  return `${mm}/${yy}`;
}

function paystackCard(value: unknown): GatewayCard | null {
  const auth = asRecord(value);
  if (!auth) return null;
  const token = typeof auth.authorization_code === 'string' ? auth.authorization_code : '';
  const last4 = typeof auth.last4 === 'string' ? auth.last4 : '';
  const month = typeof auth.exp_month === 'string' ? auth.exp_month : String(auth.exp_month ?? '');
  const year = typeof auth.exp_year === 'string' ? auth.exp_year : String(auth.exp_year ?? '');
  const expiry = formatExpiry(month, year);
  const brand = typeof auth.brand === 'string' && auth.brand
    ? auth.brand
    : typeof auth.card_type === 'string'
      ? auth.card_type
      : 'card';
  if (!token || !/^\d{4}$/.test(last4) || !expiry) return null;
  return {
    token: `paystack:${token}`,
    brand,
    last4,
    expiry,
    reusable: auth.reusable === true && auth.channel === 'card',
  };
}

function flutterwaveCard(value: unknown): GatewayCard | null {
  const card = asRecord(value);
  if (!card) return null;
  const token = typeof card.token === 'string' ? card.token : '';
  const last4 = typeof card.last_4digits === 'string' ? card.last_4digits : '';
  const expiry = typeof card.expiry === 'string' ? card.expiry : '';
  const brand = typeof card.type === 'string' && card.type ? card.type : 'card';
  const formatted = /^\d{2}\/\d{2}$/.test(expiry)
    ? expiry
    : formatExpiry(expiry.slice(0, 2), expiry.slice(-2));
  if (!token || !/^\d{4}$/.test(last4) || !formatted) return null;
  return {
    token: `flutterwave:${token}`,
    brand,
    last4,
    expiry: formatted,
    reusable: true,
  };
}

export function amountsMatch(
  expectedMinor: number,
  actualMinor: number | null,
  expectedCurrency: string,
  actualCurrency: string | null,
): boolean {
  if (actualMinor == null || !actualCurrency) return false;
  return (
    actualMinor === expectedMinor &&
    actualCurrency.toUpperCase() === expectedCurrency.toUpperCase()
  );
}

export function majorAmount(minor: number, currency: string): number {
  return majorFromMinor(minor, currency);
}
