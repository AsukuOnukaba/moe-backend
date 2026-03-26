import { Injectable } from '@nestjs/common';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { OrdersService } from '../orders/orders.service';

type Payment = {
  reference: string;
  orderId: string;
  gateway: 'paystack' | 'flutterwave';
  amount: number;
  currency: string;
  email: string;
  paymentUrl: string;
  accessCode?: string;
  txRef?: string;
  status: 'success' | 'failed' | 'pending';
  paidAt: string | null;
};

const paymentStore = new Map<string, Payment>();

@Injectable()
export class PaymentsService {
  constructor(private readonly orders: OrdersService) {}

  async initialize(user: AccessTokenPayload, body: any) {
    const orderId = typeof body?.orderId === 'string' ? body.orderId : '';
    const gateway = body?.gateway as 'paystack' | 'flutterwave';
    const amount = Number(body?.amount ?? 0);
    const currency = typeof body?.currency === 'string' ? body.currency : 'NGN';
    const email = typeof body?.email === 'string' ? body.email : '';

    if (!orderId) return { message: 'Missing orderId', code: 'VALIDATION_ERROR' };
    if (gateway !== 'paystack' && gateway !== 'flutterwave') {
      return { message: 'Invalid gateway', code: 'VALIDATION_ERROR' };
    }

    const reference = `PAY-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const paymentUrl =
      gateway === 'paystack' ? `https://paystack.com/pay/${reference}` : `https://flutterwave.com/pay/${reference}`;
    const accessCode = gateway === 'paystack' ? 'paystack_access_code' : undefined;
    const txRef = gateway === 'flutterwave' ? 'flutterwave_tx_ref' : undefined;

    const payment: Payment = {
      reference,
      orderId,
      gateway,
      amount,
      currency,
      email,
      paymentUrl,
      accessCode,
      txRef,
      status: 'pending',
      paidAt: null,
    };

    paymentStore.set(reference, payment);

    return {
      paymentUrl,
      reference,
      ...(accessCode ? { accessCode } : {}),
      ...(txRef ? { txRef } : {}),
    };
  }

  async verify(user: AccessTokenPayload, body: any) {
    const reference = typeof body?.reference === 'string' ? body.reference : '';
    const gateway = body?.gateway as 'paystack' | 'flutterwave';
    if (!reference) return { message: 'Missing reference', code: 'VALIDATION_ERROR' };

    const payment = paymentStore.get(reference);
    if (!payment) {
      return {
        reference,
        status: 'failed',
        amount: 0,
        currency: 'NGN',
        paidAt: null,
        orderId: '',
      };
    }

    // TEMP fallback: mark as success whenever verified.
    payment.status = 'success';
    payment.paidAt = new Date().toISOString();
    paymentStore.set(reference, payment);

    // Try to update the in-memory order in the user's order store.
    await this.orders.patch(user, payment.orderId, {
      status: 'in_progress',
      paymentReference: reference,
      paymentStatus: 'paid',
      paymentMethod: payment.gateway,
    });

    return {
      reference: payment.reference,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      paidAt: payment.paidAt,
      orderId: payment.orderId,
    };
  }
}

