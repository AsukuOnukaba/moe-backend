"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const orders_service_1 = require("../orders/orders.service");
const paymentStore = new Map();
let PaymentsService = class PaymentsService {
    orders;
    constructor(orders) {
        this.orders = orders;
    }
    async initialize(user, body) {
        const orderId = typeof body?.orderId === 'string' ? body.orderId : '';
        const gateway = body?.gateway;
        const amount = Number(body?.amount ?? 0);
        const currency = typeof body?.currency === 'string' ? body.currency : 'NGN';
        const email = typeof body?.email === 'string' ? body.email : '';
        if (!orderId)
            return { message: 'Missing orderId', code: 'VALIDATION_ERROR' };
        if (gateway !== 'paystack' && gateway !== 'flutterwave') {
            return { message: 'Invalid gateway', code: 'VALIDATION_ERROR' };
        }
        const reference = `PAY-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
        const paymentUrl = gateway === 'paystack' ? `https://paystack.com/pay/${reference}` : `https://flutterwave.com/pay/${reference}`;
        const accessCode = gateway === 'paystack' ? 'paystack_access_code' : undefined;
        const txRef = gateway === 'flutterwave' ? 'flutterwave_tx_ref' : undefined;
        const payment = {
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
    async verify(user, body) {
        const reference = typeof body?.reference === 'string' ? body.reference : '';
        const gateway = body?.gateway;
        if (!reference)
            return { message: 'Missing reference', code: 'VALIDATION_ERROR' };
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
        payment.status = 'success';
        payment.paidAt = new Date().toISOString();
        paymentStore.set(reference, payment);
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
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [orders_service_1.OrdersService])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map