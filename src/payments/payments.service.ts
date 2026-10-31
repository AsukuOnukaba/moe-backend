import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { PrismaService } from '../database/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { buildPaymentCallbackUrl, resolveCallbackBase } from './payment-callback';
import { chargeForOrder } from './payment-amount';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import {
  PaymentGatewayClient,
  type GatewayVerifyResult,
  type PaymentGatewayName,
} from './payment-gateway.client';
import { PaymentMethodsService } from './payment-methods.service';
import {
  flutterwaveSignatureValid,
  paystackSignatureValid,
} from './payment-signature';

const PENDING_REUSE_MS = 30 * 60 * 1000;

type AttemptRecord = {
  id: string;
  orderId: number;
  customerId: number;
  gateway: string;
  reference: string;
  amountMinor: number;
  currency: string;
  status: string;
  paymentUrl: string | null;
  accessCode: string | null;
  saveCard: boolean;
  cardOnly: boolean;
  createdAt: Date;
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly paymentMethods: PaymentMethodsService,
    private readonly gateway: PaymentGatewayClient,
  ) {}

  gateways() {
    return this.gateway.availability();
  }

  async initialize(
    user: AccessTokenPayload,
    body: InitializePaymentDto,
    requestOrigin?: string,
  ) {
    const gateway = body.gateway;
    const orderId = Number(body.orderId);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      throw new BadRequestException({ message: 'Invalid orderId', code: 'VALIDATION_ERROR' });
    }

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.customerId !== user.sub) {
      throw new NotFoundException({ message: 'Order not found', code: 'RESOURCE_NOT_FOUND' });
    }
    if (order.paymentStatus === 'paid') {
      return {
        alreadyPaid: true,
        orderId: String(order.id),
        reference: order.paymentReference,
        status: 'success' as const,
        amount: order.price,
        currency: order.currency,
      };
    }
    if (order.status === 'cancelled' || order.status === 'rejected') {
      throw new BadRequestException({
        message: 'This order can no longer be paid',
        code: 'ORDER_NOT_PAYABLE',
      });
    }
    if (!this.orderAcceptsGateway(order.paymentMethod, gateway)) {
      throw new BadRequestException({
        message: 'This order cannot be paid with the selected method',
        code: 'VALIDATION_ERROR',
      });
    }

    let charge: ReturnType<typeof chargeForOrder>;
    try {
      charge = chargeForOrder(order);
    } catch {
      throw new BadRequestException({
        message: 'This order does not have a payable amount',
        code: 'VALIDATION_ERROR',
      });
    }

    const customer = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { email: true, name: true },
    });
    if (!customer?.email) {
      throw new BadRequestException({
        message: 'A customer email is required to start payment',
        code: 'VALIDATION_ERROR',
      });
    }

    const reusable = await this.prisma.paymentAttempt.findFirst({
      where: { orderId: order.id, gateway, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });
    if (
      reusable?.paymentUrl &&
      reusable.amountMinor === charge.amountMinor &&
      reusable.currency === charge.currency &&
      Date.now() - reusable.createdAt.getTime() < PENDING_REUSE_MS
    ) {
      return this.toInitResponse(reusable, charge.amountMajor);
    }
    if (reusable) {
      await this.prisma.paymentAttempt.update({
        where: { id: reusable.id },
        data: { status: 'cancelled', failureReason: 'replaced' },
      });
    }

    const reference = newReference(gateway, order.id);
    const callbackUrl = buildPaymentCallbackUrl({
      base: resolveCallbackBase({
        requestOrigin,
        frontendUrl: this.gateway.frontendUrl(),
        corsOrigins: this.gateway.corsOrigins(),
      }),
      gateway,
      orderId: order.id,
      reference,
    });

    let attempt: AttemptRecord;
    try {
      attempt = await this.prisma.paymentAttempt.create({
        data: {
          orderId: order.id,
          customerId: user.sub,
          gateway,
          reference,
          amountMinor: charge.amountMinor,
          currency: charge.currency,
          status: 'pending',
          saveCard: body.saveCard === true,
          cardOnly: body.cardOnly === true,
        },
      });
    } catch (err) {
      if ((err as { code?: string }).code !== 'P2002') throw err;
      const existing = await this.prisma.paymentAttempt.findFirst({
        where: { orderId: order.id, gateway, status: 'pending' },
      });
      if (existing?.paymentUrl) return this.toInitResponse(existing, charge.amountMajor);
      throw err;
    }

    try {
      const started = await this.gateway.initialize({
        gateway,
        reference,
        email: customer.email,
        customerName: customer.name,
        amountMinor: charge.amountMinor,
        amountMajor: charge.amountMajor,
        currency: charge.currency,
        callbackUrl,
        orderId: order.id,
        cardOnly: body.cardOnly === true,
      });
      const updated = await this.prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          paymentUrl: started.paymentUrl,
          accessCode: started.accessCode ?? null,
        },
      });
      return this.toInitResponse(updated, charge.amountMajor);
    } catch (err) {
      await this.prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: { status: 'failed', failureReason: 'provider_initialize_failed' },
      });
      throw err;
    }
  }

  async verify(user: AccessTokenPayload, body: VerifyPaymentDto) {
    const attempt = await this.prisma.paymentAttempt.findUnique({
      where: { reference: body.reference },
    });
    if (!attempt || attempt.gateway !== body.gateway) {
      throw new NotFoundException({ message: 'Payment not found', code: 'RESOURCE_NOT_FOUND' });
    }
    if (attempt.customerId !== user.sub) {
      throw new ForbiddenException({ message: 'Forbidden', code: 'FORBIDDEN' });
    }
    return this.settle(attempt.reference, body.gateway);
  }

  async handlePaystackWebhook(rawBody: Buffer | undefined, signature: string | undefined) {
    if (!paystackSignatureValid(rawBody, signature, this.safePaystackSecret())) {
      throw new UnauthorizedException({ message: 'Invalid signature', code: 'FORBIDDEN' });
    }
    const payload = parsePayload(rawBody);
    const data = asRecord(payload.data);
    const reference = typeof data?.reference === 'string' ? data.reference : '';
    const event = typeof payload.event === 'string' ? payload.event : 'unknown';
    await this.recordWebhook('paystack', rawBody!, reference);
    if (!reference) return { received: true };
    if (event === 'charge.success' || event === 'charge.failed') {
      await this.settleSafely(reference, 'paystack');
    }
    return { received: true };
  }

  async handleFlutterwaveWebhook(rawBody: Buffer | undefined, signature: string | undefined) {
    if (!flutterwaveSignatureValid(signature, this.gateway.flutterwaveWebhookHash())) {
      throw new UnauthorizedException({ message: 'Invalid signature', code: 'FORBIDDEN' });
    }
    const payload = parsePayload(rawBody);
    const data = asRecord(payload.data);
    const reference =
      (typeof data?.tx_ref === 'string' && data.tx_ref) ||
      (typeof data?.txRef === 'string' && data.txRef) ||
      (typeof data?.reference === 'string' && data.reference) ||
      '';
    await this.recordWebhook('flutterwave', rawBody!, reference);
    if (reference) {
      await this.settleSafely(reference, 'flutterwave');
    }
    return { received: true };
  }

  private async settle(reference: string, gateway: PaymentGatewayName) {
    const attempt = await this.prisma.paymentAttempt.findUnique({ where: { reference } });
    if (!attempt || attempt.gateway !== gateway) {
      throw new NotFoundException({ message: 'Payment not found', code: 'RESOURCE_NOT_FOUND' });
    }
    if (attempt.status === 'success') {
      return this.verificationBody(attempt, 'success', attempt.paidAt?.toISOString() ?? null, true);
    }

    const remote = await this.gateway.verify(gateway, reference);
    const order = await this.prisma.order.findUnique({ where: { id: attempt.orderId } });
    if (!order) {
      throw new NotFoundException({ message: 'Order not found', code: 'RESOURCE_NOT_FOUND' });
    }

    if (remote.status !== 'success') {
      const next = remote.status === 'cancelled' ? 'cancelled' : remote.status === 'failed' ? 'failed' : 'pending';
      if (next !== 'pending') {
        await this.prisma.paymentAttempt.update({
          where: { id: attempt.id },
          data: {
            status: next,
            providerStatus: remote.status,
            verifiedAt: new Date(),
            failureReason: next,
          },
        });
        if (next === 'failed') {
          await this.orders.applyVerifiedPayment({
            orderId: order.id,
            customerId: attempt.customerId,
            gateway,
            reference: attempt.reference,
            outcome: 'failed',
          });
        }
      }
      return this.verificationBody(
        { ...attempt, currency: attempt.currency },
        next === 'pending' ? 'pending' : next,
        null,
        false,
      );
    }

    let expectedMinor = attempt.amountMinor;
    try {
      expectedMinor = chargeForOrder(order).amountMinor;
    } catch {
      expectedMinor = -1;
    }
    const referenceMatches = remote.reference === attempt.reference;
    const amountMatches =
      remote.amountMinor === attempt.amountMinor &&
      remote.amountMinor === expectedMinor &&
      remote.currency?.toUpperCase() === attempt.currency.toUpperCase();

    const failureReason = !referenceMatches
      ? 'reference_mismatch'
      : remote.currency?.toUpperCase() !== attempt.currency.toUpperCase()
        ? 'currency_mismatch'
        : 'amount_mismatch';
    if (!referenceMatches || !amountMatches) {
      await this.prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'failed',
          providerStatus: remote.status,
          verifiedAt: new Date(),
          failureReason,
        },
      });
      this.logger.warn(
        `Rejected ${gateway} payment ${attempt.reference} for order ${attempt.orderId}: ${failureReason}`,
      );
      return this.verificationBody(attempt, 'failed', null, false);
    }

    const applied = await this.orders.applyVerifiedPayment({
      orderId: order.id,
      customerId: attempt.customerId,
      gateway,
      reference: attempt.reference,
      outcome: 'paid',
    });
    const paidAt = remote.paidAt ? new Date(remote.paidAt) : new Date();
    await this.prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'success',
        providerStatus: 'success',
        verifiedAt: new Date(),
        paidAt,
        failureReason: null,
      },
    });
    if (!applied.alreadyPaid && attempt.saveCard && remote.card?.reusable) {
      await this.saveCard(attempt.customerId, remote.card);
    }
    return this.verificationBody(attempt, 'success', paidAt.toISOString(), applied.alreadyPaid);
  }

  private async settleSafely(reference: string, gateway: PaymentGatewayName) {
    try {
      await this.settle(reference, gateway);
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof BadRequestException) {
        this.logger.warn(`Webhook for ${gateway} reference ${reference} was not applied`);
        return;
      }
      throw err;
    }
  }

  private async saveCard(userId: number, card: NonNullable<GatewayVerifyResult['card']>) {
    const existing = await this.prisma.paymentMethod.findFirst({
      where: { userId, processorToken: card.token },
    });
    if (existing) return;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    try {
      await this.paymentMethods.createFromGateway({
        userId,
        gatewayToken: card.token,
        brand: card.brand,
        last4: card.last4,
        expiry: card.expiry,
        cardholderName: user?.name?.trim() || 'Customer',
      });
    } catch (err) {
      this.logger.warn(
        `Saved-card token was not stored for user ${userId}: ${
          err instanceof Error ? err.name : 'error'
        }`,
      );
    }
  }

  private async recordWebhook(gateway: PaymentGatewayName, rawBody: Buffer, reference: string) {
    const eventKey = createHash('sha256').update(rawBody).digest('hex');
    try {
      await this.prisma.paymentWebhookEvent.create({
        data: { gateway, eventKey, reference: reference || null },
      });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'P2002') return;
      throw err;
    }
  }

  private safePaystackSecret(): string {
    try {
      return this.gateway.paystackSecret();
    } catch {
      return '';
    }
  }

  private orderAcceptsGateway(paymentMethod: string, gateway: PaymentGatewayName): boolean {
    if (paymentMethod === gateway) return true;
    return paymentMethod === 'card';
  }

  private toInitResponse(
    attempt: Pick<AttemptRecord, 'reference' | 'paymentUrl' | 'accessCode' | 'gateway' | 'orderId' | 'currency' | 'amountMinor'>,
    amountMajor: number,
  ) {
    return {
      paymentUrl: attempt.paymentUrl,
      reference: attempt.reference,
      amount: amountMajor,
      currency: attempt.currency,
      orderId: String(attempt.orderId),
      ...(attempt.gateway === 'paystack' && attempt.accessCode
        ? { accessCode: attempt.accessCode }
        : {}),
      ...(attempt.gateway === 'flutterwave' ? { txRef: attempt.reference } : {}),
    };
  }

  private verificationBody(
    attempt: { reference: string; orderId: number; amountMinor: number; currency: string },
    status: 'success' | 'failed' | 'pending' | 'cancelled',
    paidAt: string | null,
    alreadyPaid: boolean,
  ) {
    const amount = attempt.amountMinor / 100;
    return {
      reference: attempt.reference,
      status,
      amount,
      currency: attempt.currency,
      paidAt,
      orderId: String(attempt.orderId),
      alreadyPaid,
    };
  }
}

function newReference(gateway: PaymentGatewayName, orderId: number): string {
  const prefix = gateway === 'paystack' ? 'moe-ps' : 'moe-fw';
  return `${prefix}-${orderId}-${randomBytes(8).toString('hex')}`;
}

function parsePayload(rawBody: Buffer | undefined): Record<string, unknown> {
  if (!rawBody) return {};
  try {
    const parsed = JSON.parse(rawBody.toString('utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
