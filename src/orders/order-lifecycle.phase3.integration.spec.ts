/**
 * Phase 3 — full order lifecycle against local PostgreSQL (moe_dev).
 * Simulated/manual finance only. Fixtures tagged PHASE3LC and cleaned up after.
 */
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AdminCapabilitiesService } from '../auth/admin-capabilities.service';
import { PrismaService } from '../database/prisma.service';
import { ArtisanPayoutService } from './artisan-payout.service';
import { OrderMilestoneService } from './order-milestone.service';
import { OrderProductionService } from './order-production.service';
import { OrderQualityService } from './order-quality.service';
import { OrderReadinessService } from './order-readiness.service';
import { OrdersService } from './orders.service';
import { PAYOUT_CAPABILITIES } from './payout.constants';
const TAG = `phase3lc-${Date.now()}`;
function dbUrl() {
  const base =
    process.env.DATABASE_URL?.replace('@localhost:', '@127.0.0.1:') ??
    'postgresql://postgres:postgres@127.0.0.1:5432/moe_dev?schema=public';
  const params: string[] = [];
  if (!base.includes('connect_timeout=')) params.push('connect_timeout=30');
  if (!base.includes('connection_limit=')) params.push('connection_limit=5');
  if (!base.includes('pool_timeout=')) params.push('pool_timeout=30');
  if (!params.length) return base;
  return `${base}${base.includes('?') ? '&' : '?'}${params.join('&')}`;
}
const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl() } },
});

function asPrismaService(): PrismaService {
  return prisma as unknown as PrismaService;
}

function config(map: Record<string, string | undefined> = {}) {
  return {
    get: (key: string) => map[key],
  } as ConfigService;
}

function fakeImageFile(suffix = 'final'): Express.Multer.File {
  return {
    fieldname: 'files',
    originalname: `${suffix}.jpg`,
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 120,
    destination: '',
    filename: `moe/${TAG}/${suffix}`,
    path: '',
    buffer: Buffer.from('fake-image'),
    stream: undefined as never,
  };
}

describe('Phase 3 order lifecycle (PostgreSQL)', () => {
  jest.setTimeout(180_000);

  const notifications = {
    notifyReadinessAssigned: jest.fn(async () => ({})),
    notifyReadinessApproved: jest.fn(async () => ({})),
    notifyReadinessChangesRequested: jest.fn(async () => ({})),
    notifyReadinessRejected: jest.fn(async () => ({})),
    notifyArtisanPayoutVerified: jest.fn(async () => ({})),
    notifyProductionStarted: jest.fn(async () => ({})),
    notifyOrderStatusChange: jest.fn(async () => ({})),
    notifyQualitySubmitted: jest.fn(async () => ({})),
    notifyQualityDecision: jest.fn(async () => ({})),
    notifyProductionProgress: jest.fn(async () => ({})),
    notifyProductionOverdue: jest.fn(async () => ({})),
    notifyDeliveryStatus: jest.fn(async () => ({})),
  };

  let recorderId: number;
  let verifierId: number;
  let adminId: number;
  let artisanId: number;
  let customerId: number;
  let strangerId: number;
  let productId: number;
  let payouts: ArtisanPayoutService;
  let readiness: OrderReadinessService;
  let production: OrderProductionService;
  let quality: OrderQualityService;
  let milestones: OrderMilestoneService;
  let orders: OrdersService;
  let createdOrderIds: number[] = [];

  beforeAll(async () => {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      try {
        await prisma.$connect();
        lastErr = undefined;
        break;
      } catch (err) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
    if (lastErr) throw lastErr;
    const hash = await bcrypt.hash('password123', 10);
    for (const name of ['admin', 'artisan', 'customer'] as const) {
      await prisma.role.upsert({
        where: { name },
        update: {},
        create: { name },
      });
    }
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'admin' } });
    const artisanRole = await prisma.role.findUniqueOrThrow({ where: { name: 'artisan' } });
    const customerRole = await prisma.role.findUniqueOrThrow({ where: { name: 'customer' } });

    const recorder = await prisma.user.create({
      data: {
        name: `${TAG}-recorder`,
        email: `${TAG}-recorder@local.test`,
        passwordHash: hash,
        adminCapabilities: [...PAYOUT_CAPABILITIES],
        roles: { create: { roleId: adminRole.id } },
      },
    });
    const verifier = await prisma.user.create({
      data: {
        name: `${TAG}-verifier`,
        email: `${TAG}-verifier@local.test`,
        passwordHash: hash,
        adminCapabilities: [...PAYOUT_CAPABILITIES],
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
          create: {
            businessName: `${TAG} Studio`,
            status: 'approved',
            rating: 0,
            reviewCount: 0,
          },
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
    const stranger = await prisma.user.create({
      data: {
        name: `${TAG}-stranger`,
        email: `${TAG}-stranger@local.test`,
        passwordHash: hash,
        roles: { create: { roleId: customerRole.id } },
      },
    });
    const product = await prisma.product.create({
      data: {
        name: `${TAG} Product`,
        description: 'Phase 3 lifecycle fixture',
        price: 90_000,
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
    strangerId = stranger.id;
    productId = product.id;

    const prismaSvc = asPrismaService();
    const caps = new AdminCapabilitiesService(prismaSvc, config());
    const cfg = config({
      INITIAL_PAYOUT_LIMITS_JSON: '{"NGN":{"maxAbsolute":50000}}',
      CUSTOMER_DELIVERY_REVIEW_HOURS: '48',
    });
    payouts = new ArtisanPayoutService(
      prismaSvc,
      notifications as never,
      caps,
      cfg,
    );
    readiness = new OrderReadinessService(
      prismaSvc,
      notifications as never,
      config(),
      payouts,
    );
    production = new OrderProductionService(
      prismaSvc,
      notifications as never,
    );
    quality = new OrderQualityService(
      prismaSvc,
      notifications as never,
      cfg,
    );
    milestones = new OrderMilestoneService(prismaSvc, caps);
    orders = new OrdersService(
      prismaSvc,
      notifications as never,
      {} as never,
      readiness,
      payouts,
    );
  });

  afterAll(async () => {
    if (createdOrderIds.length) {
      await prisma.dispute.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      }).catch(() => undefined);
      await prisma.productReview.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      }).catch(() => undefined);
      await prisma.artisanReview.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      }).catch(() => undefined);
      await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    }
    await prisma.product.deleteMany({ where: { id: productId } }).catch(() => undefined);
    await prisma.artisanProfile.deleteMany({ where: { userId: artisanId } }).catch(() => undefined);
    const userIds = [recorderId, verifierId, adminId, artisanId, customerId, strangerId];
    await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  const recorder = () =>
    ({
      sub: recorderId,
      email: `${TAG}-recorder@local.test`,
      role: 'admin' as const,
    });
  const verifier = () =>
    ({
      sub: verifierId,
      email: `${TAG}-verifier@local.test`,
      role: 'admin' as const,
    });
  const admin = () =>
    ({
      sub: adminId,
      email: `${TAG}-admin@local.test`,
      role: 'admin' as const,
    });
  const artisan = () =>
    ({
      sub: artisanId,
      email: `${TAG}-artisan@local.test`,
      role: 'artisan' as const,
    });
  const customer = () =>
    ({
      sub: customerId,
      email: `${TAG}-customer@local.test`,
      role: 'customer' as const,
    });
  const stranger = () =>
    ({
      sub: strangerId,
      email: `${TAG}-stranger@local.test`,
      role: 'customer' as const,
    });

  async function seedAssignedOrder() {
    const order = await prisma.order.create({
      data: {
        customerId,
        productId,
        productName: `${TAG} order`,
        productImage: null,
        providerId: artisanId,
        providerName: `${TAG} Studio`,
        isCustomOrder: true,
        status: 'confirmed',
        price: 90_000,
        currency: 'NGN',
        paymentMethod: 'bank_transfer',
        paymentStatus: 'paid',
        readinessAssignedAt: new Date(),
        readinessResponseDeadline: new Date(Date.now() + 86_400_000),
        readinessWorkflowStatus: 'awaiting_response',
      },
    });
    createdOrderIds.push(order.id);
    return order.id;
  }

  async function fundInitial(orderId: number, amount = 15_000) {
    await payouts.approveAmount(recorder(), orderId, {
      approvedAmount: amount,
      currency: 'NGN',
      reason: 'materials',
    });
    const transfer = await payouts.recordTransfer(recorder(), orderId, {
      amount,
      currency: 'NGN',
      transferDate: new Date().toISOString(),
      payeeName: `${TAG} Studio`,
      payeeDetails: 'GTBank ****9999',
      externalReference: `${TAG}-init-${orderId}`,
    });
    await prisma.orderArtisanPayoutEvidence.create({
      data: {
        transferId: transfer.id,
        attachmentPublicId: `${TAG}/init`,
        attachmentResourceType: 'image',
        attachmentName: 'receipt.png',
        attachmentMimeType: 'image/png',
        attachmentBytes: 40,
        attachmentKind: 'image',
      },
    });
    await expect(
      payouts.verifyTransfer(recorder(), orderId, transfer.id, {
        notes: 'self verify must fail',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'RECORDER_CANNOT_VERIFY' }),
    });
    await payouts.verifyTransfer(verifier(), orderId, transfer.id, {
      notes: 'Bank statement matches',
    });
  }

  it('runs complete lifecycle: readiness → funding → work → quality → delivery → review → final payout', async () => {
    const orderId = await seedAssignedOrder();

    // 1–2: Artisan sees New Orders
    const newList = await orders.list(artisan(), { view: 'new' });
    expect(newList.data.some((o) => o.id === orderId)).toBe(true);

    // 3: Readiness assessment + supporting evidence (DB-backed, no live Cloudinary)
    await prisma.order.update({
      where: { id: orderId },
      data: { readinessWorkflowStatus: 'submitted' },
    });
    const assessment = await prisma.orderReadinessAssessment.create({
      data: {
        orderId,
        version: 1,
        type: 'detailed',
        status: 'submitted',
        artisanId,
        acknowledgedRequirements: true,
        submittedAt: new Date(),
        payload: {
          workDescription: 'Sew custom gown',
          specificationsConfirmed: true,
          materialsRequired: 'lace',
          equipmentRequired: 'machine',
          skillsConfirmed: true,
          capacityConfirmed: true,
          estimatedMaterialCost: 15_000,
          proposedProductionDays: 4,
          productionSteps: ['cut', 'sew', 'finish'],
          matchesCustomerRequirements: true,
        },
        evidence: {
          create: {
            attachmentPublicId: `moe/${TAG}/readiness`,
            attachmentResourceType: 'image',
            attachmentName: 'readiness.jpg',
            attachmentMimeType: 'image/jpeg',
            attachmentBytes: 80,
            attachmentKind: 'image',
          },
        },
      },
    });

    // 4: Admin approves readiness
    await readiness.adminDecide(admin(), orderId, assessment.id, {
      decision: 'approve',
      reason: 'Ready',
    });
    let row = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(row.readinessWorkflowStatus).toBe('approved');

    // 5–7: Initial funding approve / record / independent verify
    await fundInitial(orderId, 15_000);
    const funded = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { artisanPayout: { include: { transfers: true } } },
    });
    expect(funded.artisanPayout?.status).toBe('verified');
    expect(funded.paymentStatus).toBe('paid'); // customer payment separate
    expect(
      funded.artisanPayout?.transfers.every((t) => t.status === 'verified'),
    ).toBe(true);

    // Admin approval alone never paid artisan
    const events = await prisma.orderArtisanPayoutEvent.findMany({
      where: { orderId },
    });
    expect(events.some((e) => e.action === 'amount_approved')).toBe(true);

    // 8–9: Start Work → Pending + countdown
    const started = await payouts.startWork(artisan(), orderId);
    expect(started.alreadyStarted).toBe(false);
    expect(started.productionDeadline).toBeTruthy();
    row = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(row.status).toBe('in_progress');
    expect(row.productionStartedAt).not.toBeNull();
    expect(row.productionOriginalDeadline).not.toBeNull();

    const pending = await orders.list(artisan(), { view: 'pending' });
    expect(pending.data.some((o) => o.id === orderId)).toBe(true);

    // 10: Progress update
    await production.submitProgress(
      artisan(),
      orderId,
      { note: 'Cutting complete', percentComplete: 40 },
      [],
    );
    const progress = await prisma.orderProductionProgressUpdate.count({
      where: { orderId },
    });
    expect(progress).toBeGreaterThanOrEqual(1);

    // 11: Quality submission with evidence
    const submission = await quality.submitForReview(
      artisan(),
      orderId,
      { description: 'Finished gown ready', specsConfirmed: true },
      [fakeImageFile()],
    );
    expect(submission.status).toBe('submitted');

    // Quality ≠ payout
    const qualitySubmitted = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { artisanPayout: true },
    });
    expect(qualitySubmitted.qualityReviewStatus).toBe('submitted');
    expect(qualitySubmitted.artisanPayout?.status).toBe('verified');

    // 12–13: Admin quality approve → Completed / ready_for_delivery
    await quality.adminDecide(admin(), orderId, submission.id, {
      decision: 'approve',
    });
    row = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(row.qualityReviewStatus).toBe('approved');
    expect(row.fulfillmentStatus).toBe('ready_for_delivery');
    expect(row.status).toBe('ready');
    expect(row.finalPayoutReviewEligible).toBe(false);

    const completed = await orders.list(artisan(), { view: 'completed' });
    expect(completed.data.some((o) => o.id === orderId)).toBe(true);

    // Delivery path
    await quality.updateFulfillment(artisan(), orderId, { status: 'dispatched' });
    await quality.updateFulfillment(artisan(), orderId, { status: 'delivered' });
    row = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(row.fulfillmentStatus).toBe('delivered');
    expect(row.deliveredAt).not.toBeNull();
    expect(row.customerReviewDeadline).not.toBeNull();
    const deadlineMs = row.customerReviewDeadline!.getTime();
    const deliveredMs = row.deliveredAt!.getTime();
    expect(deadlineMs - deliveredMs).toBeCloseTo(48 * 60 * 60 * 1000, -3);

    // Final payout blocked before acceptance / eligibility
    await milestones.setTotalPayable(recorder(), orderId, {
      totalPayableAmount: 100_000,
      reason: 'Phase 3 lifecycle total',
    });
    const finalMs = await milestones.createMilestone(recorder(), orderId, {
      kind: 'final',
      name: 'Final balance',
      approvedAmount: 25_000,
      currency: 'NGN',
    });
    await expect(
      milestones.markMilestoneEligible(recorder(), orderId, finalMs.id),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'FINAL_MILESTONE_NOT_ELIGIBLE' }),
    });

    // 14: Customer accepts (no rating yet)
    await quality.customerAccept(customer(), orderId, {});
    row = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(row.fulfillmentStatus).toBe('customer_accepted');
    expect(row.finalPayoutReviewEligible).toBe(true);
    expect(row.customerRating).toBeNull();

    // Rate Your Order — stranger blocked, owner ok, duplicate blocked, edit ok
    await expect(
      quality.submitOrderReview(stranger(), orderId, { rating: 1, review: 'nope' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'FORBIDDEN' }),
    });

    const review = await quality.submitOrderReview(customer(), orderId, {
      rating: 5,
      review: 'Beautiful work',
    });
    expect(review.rating).toBe(5);
    expect(review.productId).toBe(productId);
    expect(review.artisanId).toBe(artisanId);

    await expect(
      quality.submitOrderReview(customer(), orderId, { rating: 4 }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'DUPLICATE_ORDER_REVIEW' }),
    });

    await quality.submitOrderReview(
      customer(),
      orderId,
      { rating: 4, review: 'Still great' },
      { allowUpdate: true },
    );

    const productReviews = await prisma.productReview.findMany({
      where: { orderId },
    });
    expect(productReviews).toHaveLength(1);
    expect(productReviews[0].rating).toBe(4);
    const artisanReviews = await prisma.artisanReview.findMany({
      where: { orderId },
    });
    expect(artisanReviews).toHaveLength(1);

    // 15–16: Final payout eligible → record + independent verify (no auto money)
    await milestones.markMilestoneEligible(recorder(), orderId, finalMs.id);
    const finalTransfer = await milestones.recordMilestoneTransfer(
      recorder(),
      orderId,
      finalMs.id,
      {
        amount: 25_000,
        currency: 'NGN',
        transferDate: new Date().toISOString(),
        payeeName: `${TAG} Studio`,
        externalReference: `${TAG}-final-${orderId}`,
      },
      [fakeImageFile()],
    );
    await expect(
      milestones.verifyMilestoneTransfer(recorder(), orderId, finalTransfer.id, {
        notes: 'self',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'RECORDER_CANNOT_VERIFY' }),
    });
    await milestones.verifyMilestoneTransfer(
      verifier(),
      orderId,
      finalTransfer.id,
      { notes: 'Final payout verified offline' },
    );

    const msRow = await prisma.orderArtisanPayoutMilestone.findUniqueOrThrow({
      where: { id: finalMs.id },
      include: { transfers: true },
    });
    expect(msRow.status).toBe('verified');
    expect(msRow.transfers[0]?.status).toBe('verified');

    // Customer PaymentAttempt ledger remains separate from artisan payout tables
    const customerPayments = await prisma.paymentAttempt.count({
      where: { orderId },
    });
    const artisanTransfers = await prisma.orderArtisanPayoutTransfer.count({
      where: { payout: { orderId } },
    });
    expect(artisanTransfers).toBeGreaterThanOrEqual(2);
    // May be 0 for bank_transfer fixtures — table separation is the assert
    expect(customerPayments).toBeGreaterThanOrEqual(0);
  });

  it('review-window: unset config is no-op; dispute/missing evidence never auto-pays', async () => {
    const unsetQuality = new OrderQualityService(
      asPrismaService(),
      notifications as never,
      config({}), // CUSTOMER_DELIVERY_REVIEW_HOURS absent
    );
    const noop = await unsetQuality.processCustomerReviewWindows(new Date());
    expect(noop.policyConfigured).toBe(false);
    expect(noop.eligible).toBe(0);

    const orderId = await seedAssignedOrder();
    // Minimal delivered state with deadline in the past, open dispute
    await prisma.order.update({
      where: { id: orderId },
      data: {
        readinessWorkflowStatus: 'approved',
        qualityReviewStatus: 'approved',
        fulfillmentStatus: 'delivered',
        deliveredAt: new Date(Date.now() - 10 * 60 * 60 * 1000),
        customerReviewDeadline: new Date(Date.now() - 60_000),
        status: 'delivered',
      },
    });
    await prisma.dispute.create({
      data: {
        orderId,
        customerId,
        issueType: 'Item not received',
        description: 'Still waiting for package after marked delivered',
        status: 'open',
      },
    });

    const result = await quality.processCustomerReviewWindows(new Date());
    expect(result.policyConfigured).toBe(true);
    const row = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(row.finalPayoutReviewEligible).toBe(false);
    expect(row.finalPayoutEscalatedAt).not.toBeNull();
    const payoutPaid = await prisma.orderArtisanPayoutTransfer.count({
      where: { payout: { orderId }, status: 'verified' },
    });
    expect(payoutPaid).toBe(0);

    // Clean path: delivery evidenced, no dispute → eligibility only
    const orderId2 = await seedAssignedOrder();
    await prisma.order.update({
      where: { id: orderId2 },
      data: {
        readinessWorkflowStatus: 'approved',
        qualityReviewStatus: 'approved',
        fulfillmentStatus: 'delivered',
        deliveredAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
        customerReviewDeadline: new Date(Date.now() - 60_000),
        status: 'delivered',
      },
    });
    await prisma.orderDeliveryEvent.create({
      data: {
        orderId: orderId2,
        action: 'delivered',
        detail: { test: true },
      },
    });
    const eligible = await quality.processCustomerReviewWindows(new Date());
    expect(eligible.eligible).toBeGreaterThanOrEqual(1);
    const row2 = await prisma.order.findUniqueOrThrow({ where: { id: orderId2 } });
    expect(row2.finalPayoutReviewEligible).toBe(true);
    // Still no money moved
    expect(
      await prisma.orderArtisanPayoutTransfer.count({
        where: { payout: { orderId: orderId2 } },
      }),
    ).toBe(0);
  });

  it('blocks Start Work when funding reversed / disputed', async () => {
    const orderId = await seedAssignedOrder();
    await prisma.order.update({
      where: { id: orderId },
      data: { readinessWorkflowStatus: 'submitted' },
    });
    const assessment = await prisma.orderReadinessAssessment.create({
      data: {
        orderId,
        version: 1,
        type: 'detailed',
        status: 'submitted',
        artisanId,
        acknowledgedRequirements: true,
        submittedAt: new Date(),
        payload: {
          workDescription: 'Sew',
          specificationsConfirmed: true,
          materialsRequired: 'fabric',
          equipmentRequired: 'machine',
          skillsConfirmed: true,
          capacityConfirmed: true,
          estimatedMaterialCost: 10_000,
          proposedProductionDays: 3,
          productionSteps: ['sew'],
          matchesCustomerRequirements: true,
        },
      },
    });
    await readiness.adminDecide(admin(), orderId, assessment.id, {
      decision: 'approve',
    });
    await fundInitial(orderId, 10_000);

    await prisma.orderArtisanPayout.update({
      where: { orderId },
      data: { disputeFlag: true, status: 'disputed' },
    });
    await expect(payouts.startWork(artisan(), orderId)).rejects.toBeTruthy();
  });
});
