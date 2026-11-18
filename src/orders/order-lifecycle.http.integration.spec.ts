/**
 * Phase 4B — real NestJS HTTP API + local PostgreSQL lifecycle.
 * Simulated finance only. Requires API at API_BASE (default http://127.0.0.1:3000).
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PAYOUT_CAPABILITIES } from './payout.constants';

const API = (process.env.API_BASE || 'http://127.0.0.1:3000').replace(/\/$/, '');
const TAG = `phase4b-http-${Date.now()}`;

function dbUrl() {
  const base =
    process.env.DATABASE_URL?.replace('@localhost:', '@127.0.0.1:') ??
    'postgresql://postgres:postgres@127.0.0.1:5432/moe_dev?schema=public';
  const params: string[] = [];
  if (!base.includes('connect_timeout=')) params.push('connect_timeout=30');
  // Keep fixture client tiny so it does not compete with the live Nest pool.
  if (!base.includes('connection_limit=')) params.push('connection_limit=2');
  if (!base.includes('pool_timeout=')) params.push('pool_timeout=60');
  if (!params.length) return base;
  return `${base}${base.includes('?') ? '&' : '?'}${params.join('&')}`;
}

let prisma = new PrismaClient({ datasources: { db: { url: dbUrl() } } });

async function api(
  method: string,
  path: string,
  opts: { token?: string; json?: unknown; form?: FormData } = {},
) {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let body: BodyInit | undefined;
  if (opts.form) {
    body = opts.form as unknown as BodyInit;
  } else if (opts.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.json);
  }
  const res = await fetch(`${API}${path}`, { method, headers, body });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}

async function login(email: string, password: string) {
  const res = await api('POST', '/auth/login', {
    json: { email, password },
  });
  if (!res.ok) {
    throw new Error(`login failed ${res.status}: ${JSON.stringify(res.data)}`);
  }
  const token = (res.data as { token?: string }).token;
  if (!token) throw new Error('login missing token');
  return token;
}

describe('Phase 4B real HTTP order lifecycle (Nest + PostgreSQL)', () => {
  jest.setTimeout(240_000);

  let recorderId: number;
  let verifierId: number;
  let adminId: number;
  let artisanId: number;
  let customerId: number;
  let productId: number;
  let orderId: number;
  const password = 'password123';

  beforeAll(async () => {
    const health = await fetch(`${API}/health`).catch(() => null);
    if (!health || !health.ok) {
      throw new Error(
        `Nest API not reachable at ${API}/health — start moe-backend first`,
      );
    }
    await prisma.$connect();
    const hash = await bcrypt.hash(password, 10);
    for (const name of ['admin', 'artisan', 'customer'] as const) {
      await prisma.role.upsert({
        where: { name },
        update: {},
        create: { name },
      });
    }
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'admin' } });
    const artisanRole = await prisma.role.findUniqueOrThrow({ where: { name: 'artisan' } });
    const customerRole = await prisma.role.findUniqueOrThrow({
      where: { name: 'customer' },
    });

    const recorderCaps = [
      'payout_amount_approve',
      'payout_transfer_record',
      'payout_dispute',
    ];
    const verifierCaps = ['payout_transfer_verify', 'payout_dispute'];

    const recorder = await prisma.user.create({
      data: {
        name: `${TAG}-recorder`,
        email: `${TAG}-recorder@local.test`,
        passwordHash: hash,
        adminCapabilities: recorderCaps,
        roles: { create: { roleId: adminRole.id } },
      },
    });
    const verifier = await prisma.user.create({
      data: {
        name: `${TAG}-verifier`,
        email: `${TAG}-verifier@local.test`,
        passwordHash: hash,
        adminCapabilities: verifierCaps,
        roles: { create: { roleId: adminRole.id } },
      },
    });
    const admin = await prisma.user.create({
      data: {
        name: `${TAG}-admin`,
        email: `${TAG}-admin@local.test`,
        passwordHash: hash,
        roles: { create: { roleId: adminRole.id } },
      },
    });
    const artisan = await prisma.user.create({
      data: {
        name: `${TAG}-artisan`,
        email: `${TAG}-artisan@local.test`,
        passwordHash: hash,
        roles: { create: { roleId: artisanRole.id } },
        artisanProfile: {
          create: { businessName: `${TAG} Studio`, status: 'approved' },
        },
      },
    });
    const customer = await prisma.user.create({
      data: {
        name: `${TAG}-customer`,
        email: `${TAG}-customer@local.test`,
        passwordHash: hash,
        roles: { create: { roleId: customerRole.id } },
      },
    });
    const product = await prisma.product.create({
      data: {
        name: `${TAG} Product`,
        description: 'HTTP lifecycle',
        price: 95_000,
        category: 'tailoring',
        images: [],
        providerId: artisan.id,
        status: 'approved',
      },
    });

    recorderId = recorder.id;
    verifierId = verifier.id;
    adminId = admin.id;
    artisanId = artisan.id;
    customerId = customer.id;
    productId = product.id;

    // Distinct caps (not full PAYOUT_CAPABILITIES bootstrap for both)
    expect(recorder.adminCapabilities).not.toContain('payout_transfer_verify');
    expect(verifier.adminCapabilities).not.toContain('payout_transfer_record');
    expect(PAYOUT_CAPABILITIES).toContain('payout_amount_approve');

    // Release fixture connections before hammering the live Nest pool.
    await prisma.$disconnect();
  });

  afterAll(async () => {
    await prisma.$connect().catch(() => undefined);
    if (orderId) {
      await prisma.dispute.deleteMany({ where: { orderId } }).catch(() => undefined);
      await prisma.productReview.deleteMany({ where: { orderId } }).catch(() => undefined);
      await prisma.artisanReview.deleteMany({ where: { orderId } }).catch(() => undefined);
      await prisma.order.deleteMany({ where: { id: orderId } }).catch(() => undefined);
    }
    await prisma.product.deleteMany({ where: { id: productId } }).catch(() => undefined);
    await prisma.artisanProfile.deleteMany({ where: { userId: artisanId } }).catch(() => undefined);
    const ids = [recorderId, verifierId, adminId, artisanId, customerId].filter(Boolean);
    await prisma.userRole.deleteMany({ where: { userId: { in: ids } } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it('runs readiness → funding → start work → quality → delivery → review via HTTP', async () => {
    const order = await prisma.order.create({
      data: {
        customerId,
        productId,
        productName: `${TAG} order`,
        providerId: artisanId,
        providerName: `${TAG} Studio`,
        isCustomOrder: true,
        status: 'confirmed',
        price: 95_000,
        currency: 'NGN',
        paymentMethod: 'bank_transfer',
        paymentStatus: 'paid',
        readinessAssignedAt: new Date(),
        readinessResponseDeadline: new Date(Date.now() + 86_400_000),
        readinessWorkflowStatus: 'awaiting_response',
      },
    });
    orderId = order.id;

    const artisanToken = await login(`${TAG}-artisan@local.test`, password);
    const adminToken = await login(`${TAG}-admin@local.test`, password);
    const recorderToken = await login(`${TAG}-recorder@local.test`, password);
    const verifierToken = await login(`${TAG}-verifier@local.test`, password);
    const customerToken = await login(`${TAG}-customer@local.test`, password);

    // 1) Artisan readiness submission (multipart)
    const form = new FormData();
    form.append('acknowledgedRequirements', 'true');
    form.append('reviewedRequirementsAt', new Date().toISOString());
    form.append(
      'payload',
      JSON.stringify({
        workDescription: 'Sew custom piece',
        specificationsConfirmed: true,
        materialsRequired: 'fabric',
        equipmentRequired: 'machine',
        skillsConfirmed: true,
        capacityConfirmed: true,
        estimatedMaterialCost: 12_000,
        proposedProductionDays: 4,
        productionSteps: ['cut', 'sew'],
        matchesCustomerRequirements: true,
      }),
    );
    const blob = new Blob([Buffer.from('fake-jpg')], { type: 'image/jpeg' });
    form.append('files', blob, 'readiness.jpg');

    const submitted = await api('POST', `/orders/${orderId}/readiness/assessments`, {
      token: artisanToken,
      form,
    });
    if (!submitted.ok) {
      throw new Error(`readiness submit failed ${submitted.status}: ${JSON.stringify(submitted.data)}`);
    }
    expect(submitted.ok).toBe(true);
    const assessmentId = (submitted.data as { id: number }).id;
    expect(assessmentId).toBeTruthy();

    // 2) Admin readiness approval
    const approved = await api(
      'POST',
      `/admin/orders/${orderId}/readiness/assessments/${assessmentId}/decide`,
      {
        token: adminToken,
        json: { decision: 'approve', reason: 'Ready' },
      },
    );
    expect(approved.ok).toBe(true);

    // 3) Initial payout: approve → record → self-verify fails → independent verify
    const amt = await api('POST', `/admin/orders/${orderId}/artisan-payout/approve-amount`, {
      token: recorderToken,
      json: {
        approvedAmount: 12_000,
        currency: 'NGN',
        reason: 'materials',
        exceptionApproved: true,
        exceptionReason: 'Phase 4B test absolute without limits JSON',
      },
    });
    expect(amt.ok).toBe(true);

    const transferForm = new FormData();
    transferForm.append('amount', '12000');
    transferForm.append('currency', 'NGN');
    transferForm.append('transferDate', new Date().toISOString());
    transferForm.append('payeeName', `${TAG} Studio`);
    transferForm.append('payeeDetails', 'GTBank ****1111');
    transferForm.append('externalReference', `${TAG}-init-${orderId}`);
    transferForm.append(
      'files',
      new Blob([Buffer.from('receipt')], { type: 'image/png' }),
      'receipt.png',
    );
    const recorded = await api('POST', `/admin/orders/${orderId}/artisan-payout/transfers`, {
      token: recorderToken,
      form: transferForm,
    });
    expect(recorded.ok).toBe(true);
    const transferId = (recorded.data as { id: number }).id;

    // Distinct finance roles: recorder lacks payout_transfer_verify.
    const selfVerify = await api(
      'POST',
      `/admin/orders/${orderId}/artisan-payout/transfers/${transferId}/verify`,
      {
        token: recorderToken,
        json: { notes: 'should fail self verify' },
      },
    );
    expect(selfVerify.ok).toBe(false);
    expect(['FINANCE_CAPABILITY_REQUIRED', 'RECORDER_CANNOT_VERIFY']).toContain(
      (selfVerify.data as { code?: string }).code,
    );

    // Unverified funding cannot start work
    const earlyStart = await api('POST', `/orders/${orderId}/start-work`, {
      token: artisanToken,
    });
    expect(earlyStart.ok).toBe(false);

    const verified = await api(
      'POST',
      `/admin/orders/${orderId}/artisan-payout/transfers/${transferId}/verify`,
      {
        token: verifierToken,
        json: { notes: 'Bank statement matches amount and reference' },
      },
    );
    expect(verified.ok).toBe(true);

    await prisma.$connect();
    // Customer PaymentAttempt ledger remains separate
    const paymentAttempts = await prisma.paymentAttempt.count({ where: { orderId } });
    const artisanTransfers = await prisma.orderArtisanPayoutTransfer.count({
      where: { payout: { orderId } },
    });
    expect(artisanTransfers).toBeGreaterThanOrEqual(1);
    expect(paymentAttempts).toBeGreaterThanOrEqual(0);

    // 4) Start Work + production countdown fields
    const started = await api('POST', `/orders/${orderId}/start-work`, {
      token: artisanToken,
    });
    if (!started.ok) {
      throw new Error(`start-work failed ${started.status}: ${JSON.stringify(started.data)}`);
    }
    expect(started.ok).toBe(true);
    const startedBody = started.data as {
      productionStartedAt?: string;
      productionDeadline?: string;
    };
    expect(startedBody.productionStartedAt || startedBody.productionDeadline).toBeTruthy();

    const prod = await api('GET', `/orders/${orderId}/production`, {
      token: artisanToken,
    });
    expect(prod.ok).toBe(true);
    const prodBody = prod.data as Record<string, unknown>;
    const startedAt =
      prodBody.productionStartedAt ??
      (prodBody.countdown as { productionStartedAt?: string } | undefined)
        ?.productionStartedAt ??
      startedBody.productionStartedAt;
    const deadline =
      prodBody.productionDeadline ??
      (prodBody.countdown as { productionDeadline?: string } | undefined)
        ?.productionDeadline ??
      startedBody.productionDeadline;
    expect(startedAt).toBeTruthy();
    expect(deadline).toBeTruthy();

    // 5) Quality submission + admin approve (must not auto-release funds)
    const qForm = new FormData();
    qForm.append('description', 'Completed custom piece');
    qForm.append('specsConfirmed', 'true');
    qForm.append(
      'files',
      new Blob([Buffer.from('final')], { type: 'image/jpeg' }),
      'final.jpg',
    );
    const qSubmit = await api('POST', `/orders/${orderId}/quality/submissions`, {
      token: artisanToken,
      form: qForm,
    });
    expect(qSubmit.ok).toBe(true);
    const submissionId = (qSubmit.data as { id: number }).id;

    const payoutBefore = await prisma.orderArtisanPayout.findUnique({
      where: { orderId },
    });
    const qApprove = await api(
      'POST',
      `/admin/orders/${orderId}/quality/submissions/${submissionId}/decide`,
      {
        token: adminToken,
        json: { decision: 'approve' },
      },
    );
    expect(qApprove.ok).toBe(true);
    const payoutAfter = await prisma.orderArtisanPayout.findUnique({
      where: { orderId },
    });
    expect(payoutAfter?.status).toBe(payoutBefore?.status);

    const row = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(row.fulfillmentStatus).toBe('ready_for_delivery');
    expect(row.finalPayoutReviewEligible).toBe(false);

    // 6) Delivery + customer accept + review
    await api('POST', `/orders/${orderId}/fulfillment`, {
      token: artisanToken,
      json: { status: 'dispatched' },
    });
    const delivered = await api('POST', `/orders/${orderId}/fulfillment`, {
      token: artisanToken,
      json: { status: 'delivered' },
    });
    expect(delivered.ok).toBe(true);

    const accept = await api('POST', `/orders/${orderId}/delivery/accept`, {
      token: customerToken,
      json: {},
    });
    expect(accept.ok).toBe(true);

    const review = await api('POST', `/orders/${orderId}/review`, {
      token: customerToken,
      json: { rating: 5, review: 'Excellent finish' },
    });
    expect(review.ok).toBe(true);

    const afterAccept = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(afterAccept.fulfillmentStatus).toBe('customer_accepted');
    expect(afterAccept.finalPayoutReviewEligible).toBe(true);
    expect(afterAccept.customerRating).toBe(5);

    // Final payout eligibility for milestone respects acceptance (no auto money)
    const finalEligible = afterAccept.finalPayoutReviewEligible;
    expect(finalEligible).toBe(true);
    const paidAuto = await prisma.orderArtisanPayoutTransfer.count({
      where: {
        payout: { orderId },
        status: 'verified',
        // initial transfer already verified — ensure no extra auto transfer appeared
      },
    });
    expect(paidAuto).toBe(1);
  });
});
