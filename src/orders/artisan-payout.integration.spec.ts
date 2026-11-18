/**
 * Phase 2 Batch 1C — DB-backed integration against local PostgreSQL (moe_dev).
 * Creates isolated fixture rows tagged with BATCH1C and deletes them after.
 */
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AdminCapabilitiesService } from '../auth/admin-capabilities.service';
import { PrismaService } from '../database/prisma.service';
import { ArtisanPayoutService } from './artisan-payout.service';
import { OrderReadinessService } from './order-readiness.service';
import { OrdersService } from './orders.service';
import { PAYOUT_CAPABILITIES } from './payout.constants';

const TAG = `batch1c-${Date.now()}`;
function dbUrl() {
  const base =
    process.env.DATABASE_URL?.replace('@localhost:', '@127.0.0.1:') ??
    'postgresql://postgres:postgres@127.0.0.1:5432/moe_dev?schema=public';
  const params: string[] = [];
  if (!base.includes('connect_timeout=')) params.push('connect_timeout=30');
  // Integration suites create a dedicated PrismaClient; keep the pool small so
  // parallel Nest/dev clients do not exhaust Postgres (environment flake).
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

describe('Artisan payout Batch 1C (PostgreSQL)', () => {
  jest.setTimeout(120_000);

  const notifications = {
    notifyReadinessAssigned: jest.fn(async () => ({})),
    notifyReadinessApproved: jest.fn(async () => ({})),
    notifyReadinessChangesRequested: jest.fn(async () => ({})),
    notifyReadinessRejected: jest.fn(async () => ({})),
    notifyArtisanPayoutVerified: jest.fn(async () => ({})),
    notifyProductionStarted: jest.fn(async () => ({})),
    notifyOrderStatusChange: jest.fn(async () => ({})),
  };

  let recorderId: number;
  let verifierId: number;
  let artisanId: number;
  let customerId: number;
  let productId: number;
  let payouts: ArtisanPayoutService;
  let readiness: OrderReadinessService;
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

    // Recorder has verify capability so the self-verify guard can be exercised
    // (capability alone is not enough — same actor must still be rejected).
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
    const product = await prisma.product.create({
      data: {
        name: `${TAG} Product`,
        description: 'Batch 1C fixture',
        price: 80_000,
        category: 'tailoring',
        images: [],
        providerId: artisan.id,
        status: 'approved',
      },
    });

    recorderId = recorder.id;
    verifierId = verifier.id;
    artisanId = artisan.id;
    customerId = customer.id;
    productId = product.id;

    const prismaSvc = asPrismaService();
    const caps = new AdminCapabilitiesService(prismaSvc, config());
    payouts = new ArtisanPayoutService(
      prismaSvc,
      notifications as never,
      caps,
      config({
        // Absolute limit so approve without inventing a percentage.
        INITIAL_PAYOUT_LIMITS_JSON: '{"NGN":{"maxAbsolute":50000}}',
      }),
    );
    readiness = new OrderReadinessService(
      prismaSvc,
      notifications as never,
      config(),
      payouts,
    );
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
      await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    }
    await prisma.product.deleteMany({ where: { id: productId } }).catch(() => undefined);
    await prisma.artisanProfile.deleteMany({ where: { userId: artisanId } }).catch(() => undefined);
    await prisma.userRole.deleteMany({
      where: { userId: { in: [recorderId, verifierId, artisanId, customerId] } },
    }).catch(() => undefined);
    await prisma.user.deleteMany({
      where: { id: { in: [recorderId, verifierId, artisanId, customerId] } },
    }).catch(() => undefined);
    await prisma.$disconnect();
  });

  async function createReadyOrder(opts: {
    isCustomOrder?: boolean;
    materialCost?: number;
    assessmentType?: 'standard' | 'detailed';
    status?: string;
    paymentStatus?: string;
    paymentMethod?: string;
    proposedDays?: number;
  }) {
    const order = await prisma.order.create({
      data: {
        customerId,
        productId,
        productName: `${TAG} order`,
        productImage: null,
        providerId: artisanId,
        providerName: `${TAG} Studio`,
        isCustomOrder: !!opts.isCustomOrder,
        status: opts.status ?? 'confirmed',
        price: 80_000,
        currency: 'NGN',
        paymentMethod: opts.paymentMethod ?? 'bank_transfer',
        paymentStatus: opts.paymentStatus ?? 'paid',
        readinessAssignedAt: new Date(),
        readinessResponseDeadline: new Date(Date.now() + 86_400_000),
        readinessWorkflowStatus: 'submitted',
      },
    });
    createdOrderIds.push(order.id);

    const type = opts.assessmentType ?? (opts.isCustomOrder ? 'detailed' : 'standard');
    const payload =
      type === 'detailed'
        ? {
            workDescription: 'Sew',
            specificationsConfirmed: true,
            materialsRequired: 'fabric',
            equipmentRequired: 'machine',
            skillsConfirmed: true,
            capacityConfirmed: true,
            estimatedMaterialCost: opts.materialCost ?? 12_000,
            proposedProductionDays: opts.proposedDays ?? 5,
            productionSteps: ['cut', 'sew'],
            matchesCustomerRequirements: true,
          }
        : {
            productAvailable: true,
            exactSpecMatch: true,
            quantityConfirmed: true,
            canFulfil: true,
            estimatedDispatchDate: new Date().toISOString().slice(0, 10),
          };

    const assessment = await prisma.orderReadinessAssessment.create({
      data: {
        orderId: order.id,
        version: 1,
        type,
        status: 'submitted',
        artisanId,
        payload,
        acknowledgedRequirements: true,
        submittedAt: new Date(),
      },
    });

    await readiness.adminDecide(
      { sub: verifierId, email: `${TAG}-verifier@local.test`, role: 'admin' },
      order.id,
      assessment.id,
      { decision: 'approve', reason: 'Batch 1C approve' },
    );

    return { orderId: order.id, assessmentId: assessment.id };
  }

  it('migration columns and payout tables exist', async () => {
    const cols = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Order'
        AND column_name IN ('productionStartedAt','productionDeadline','productionStartedById','productionDurationDays')
      ORDER BY column_name
    `;
    expect(cols.map((c) => c.column_name)).toEqual([
      'productionDeadline',
      'productionDurationDays',
      'productionStartedAt',
      'productionStartedById',
    ]);

    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'OrderArtisanPayout','OrderArtisanPayoutTransfer',
          'OrderArtisanPayoutEvidence','OrderArtisanPayoutEvent'
        )
      ORDER BY table_name
    `;
    expect(tables.map((t) => t.table_name)).toEqual([
      'OrderArtisanPayout',
      'OrderArtisanPayoutEvent',
      'OrderArtisanPayoutEvidence',
      'OrderArtisanPayoutTransfer',
    ]);

    const caps = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'adminCapabilities'
    `;
    expect(caps).toHaveLength(1);
  });

  it('approves amount, blocks self-verify, verifies via second admin, starts work once', async () => {
    const { orderId } = await createReadyOrder({
      isCustomOrder: true,
      materialCost: 12_000,
      assessmentType: 'detailed',
    });

    const recorder = {
      sub: recorderId,
      email: `${TAG}-recorder@local.test`,
      role: 'admin' as const,
    };
    const verifier = {
      sub: verifierId,
      email: `${TAG}-verifier@local.test`,
      role: 'admin' as const,
    };
    const artisan = {
      sub: artisanId,
      email: `${TAG}-artisan@local.test`,
      role: 'artisan' as const,
    };

    await payouts.approveAmount(recorder, orderId, {
      approvedAmount: 12_000,
      currency: 'NGN',
      reason: 'materials',
    });

    const ref = `${TAG}-TRX-${orderId}`;
    const transfer = await payouts.recordTransfer(recorder, orderId, {
      amount: 12_000,
      currency: 'NGN',
      transferDate: new Date().toISOString(),
      payeeName: `${TAG} Studio`,
      payeeDetails: 'GTBank ****1234',
      externalReference: ref,
    });

    // Supporting evidence persisted in DB (no live Cloudinary required for verify gate).
    await prisma.orderArtisanPayoutEvidence.create({
      data: {
        transferId: transfer.id,
        attachmentPublicId: `${TAG}/evidence`,
        attachmentResourceType: 'image',
        attachmentName: 'receipt.png',
        attachmentMimeType: 'image/png',
        attachmentBytes: 100,
        attachmentKind: 'image',
      },
    });

    await expect(
      payouts.verifyTransfer(recorder, orderId, transfer.id, {
        notes: 'self verify should fail',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'RECORDER_CANNOT_VERIFY' }),
    });

    // Insufficient partial path: dispute blocks before start.
    let eligibility = await payouts.evaluateStartWorkEligibility(
      await prisma.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { artisanPayout: { include: { transfers: true } } },
      }),
    );
    expect(eligibility.eligible).toBe(false);

    await payouts.verifyTransfer(verifier, orderId, transfer.id, {
      notes: 'Bank statement matches reference and amount',
    });

    eligibility = await payouts.evaluateStartWorkEligibility(
      await prisma.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { artisanPayout: { include: { transfers: true } } },
      }),
    );
    expect(eligibility.eligible).toBe(true);

    const started = await payouts.startWork(artisan, orderId);
    expect(started.alreadyStarted).toBe(false);
    expect(started.status).toBe('in_progress');
    expect(started.productionStartedAt).toBeTruthy();
    expect(started.productionDeadline).toBeTruthy();

    const reloaded = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(reloaded.productionStartedAt).not.toBeNull();
    expect(reloaded.productionDeadline).not.toBeNull();
    expect(reloaded.productionDurationDays).toBe(5);
    expect(reloaded.status).toBe('in_progress');

    const history = await prisma.orderStatusHistory.findMany({
      where: { orderId, status: 'in_progress' },
    });
    expect(history.length).toBeGreaterThanOrEqual(1);

    const again = await payouts.startWork(artisan, orderId);
    expect(again.alreadyStarted).toBe(true);
    expect(again.productionStartedAt).toBe(started.productionStartedAt);
  });

  it('insufficient verified funding and dispute block Start Work', async () => {
    const { orderId } = await createReadyOrder({
      isCustomOrder: true,
      materialCost: 20_000,
      assessmentType: 'detailed',
    });
    const recorder = {
      sub: recorderId,
      email: `${TAG}-recorder@local.test`,
      role: 'admin' as const,
    };
    const verifier = {
      sub: verifierId,
      email: `${TAG}-verifier@local.test`,
      role: 'admin' as const,
    };
    const artisan = {
      sub: artisanId,
      email: `${TAG}-artisan@local.test`,
      role: 'artisan' as const,
    };

    await payouts.approveAmount(recorder, orderId, {
      approvedAmount: 20_000,
      currency: 'NGN',
    });
    const transfer = await payouts.recordTransfer(recorder, orderId, {
      amount: 5_000,
      currency: 'NGN',
      transferDate: new Date().toISOString(),
      payeeName: `${TAG} Studio`,
      externalReference: `${TAG}-partial-${orderId}`,
    });
    await prisma.orderArtisanPayoutEvidence.create({
      data: {
        transferId: transfer.id,
        attachmentPublicId: `${TAG}/partial`,
        attachmentResourceType: 'image',
        attachmentName: 'partial.png',
        attachmentMimeType: 'image/png',
        attachmentBytes: 10,
        attachmentKind: 'image',
      },
    });
    await payouts.verifyTransfer(verifier, orderId, transfer.id, {
      notes: 'partial only',
    });

    await expect(payouts.startWork(artisan, orderId)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PAYOUT_INSUFFICIENT' }),
    });

    // Top up then dispute before start
    const top = await payouts.recordTransfer(recorder, orderId, {
      amount: 15_000,
      currency: 'NGN',
      transferDate: new Date().toISOString(),
      payeeName: `${TAG} Studio`,
      externalReference: `${TAG}-topup-${orderId}`,
    });
    await prisma.orderArtisanPayoutEvidence.create({
      data: {
        transferId: top.id,
        attachmentPublicId: `${TAG}/top`,
        attachmentResourceType: 'image',
        attachmentName: 'top.png',
        attachmentMimeType: 'image/png',
        attachmentBytes: 10,
        attachmentKind: 'image',
      },
    });
    await payouts.verifyTransfer(verifier, orderId, top.id, {
      notes: 'top-up ok',
    });

    await payouts.disputeOrReverse(verifier, orderId, {
      notes: 'Customer bank reversal reported',
      reverse: false,
    });

    await expect(payouts.startWork(artisan, orderId)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PAYOUT_DISPUTED' }),
    });

    await expect(
      orders.patchStatus(artisan, String(orderId), { status: 'in_progress' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'READINESS_PRODUCTION_BLOCKED' }),
    });

    await expect(
      orders.adminPatch(orderId, { status: 'in_progress' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'READINESS_PRODUCTION_BLOCKED' }),
    });
  });

  it('not_required cannot bypass mandatory production funding on custom orders', async () => {
    const { orderId } = await createReadyOrder({
      isCustomOrder: true,
      materialCost: 9_000,
      assessmentType: 'detailed',
    });
    const verifier = {
      sub: verifierId,
      email: `${TAG}-verifier@local.test`,
      role: 'admin' as const,
    };

    await expect(
      payouts.markFundingNotRequired(verifier, orderId, {
        reason: 'trying to skip funding',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'FUNDING_REQUIRED' }),
    });
  });

  it('not_required allowed for standard in-stock orders and unlocks Start Work', async () => {
    const { orderId } = await createReadyOrder({
      isCustomOrder: false,
      assessmentType: 'standard',
    });
    const verifier = {
      sub: verifierId,
      email: `${TAG}-verifier@local.test`,
      role: 'admin' as const,
    };
    const artisan = {
      sub: artisanId,
      email: `${TAG}-artisan@local.test`,
      role: 'artisan' as const,
    };

    await payouts.markFundingNotRequired(verifier, orderId, {
      reason: 'Ready-made stock; no materials advance needed',
    });
    const started = await payouts.startWork(artisan, orderId);
    expect(started.status).toBe('in_progress');
  });

  it('legacy orders without readiness remain startable via status patch', async () => {
    const legacy = await prisma.order.create({
      data: {
        customerId,
        productId,
        productName: `${TAG} legacy`,
        providerId: artisanId,
        providerName: `${TAG} Studio`,
        isCustomOrder: false,
        status: 'confirmed',
        price: 10_000,
        currency: 'NGN',
        paymentMethod: 'cod',
        paymentStatus: 'unpaid',
        readinessWorkflowStatus: null,
      },
    });
    createdOrderIds.push(legacy.id);

    const artisan = {
      sub: artisanId,
      email: `${TAG}-artisan@local.test`,
      role: 'artisan' as const,
    };
    const updated = await orders.patchStatus(artisan, String(legacy.id), {
      status: 'in_progress',
    });
    expect(updated.status).toBe('in_progress');
    expect(updated.production).toBeNull();
  });

  it('payout and production fields survive reload', async () => {
    const { orderId } = await createReadyOrder({
      isCustomOrder: true,
      materialCost: 8_000,
      assessmentType: 'detailed',
      proposedDays: 3,
    });
    const recorder = {
      sub: recorderId,
      email: `${TAG}-recorder@local.test`,
      role: 'admin' as const,
    };
    const verifier = {
      sub: verifierId,
      email: `${TAG}-verifier@local.test`,
      role: 'admin' as const,
    };
    const artisan = {
      sub: artisanId,
      email: `${TAG}-artisan@local.test`,
      role: 'artisan' as const,
    };

    await payouts.approveAmount(recorder, orderId, {
      approvedAmount: 8_000,
      currency: 'NGN',
    });
    const transfer = await payouts.recordTransfer(recorder, orderId, {
      amount: 8_000,
      currency: 'NGN',
      transferDate: new Date().toISOString(),
      payeeName: `${TAG} Studio`,
      externalReference: `${TAG}-persist-${orderId}`,
    });
    await prisma.orderArtisanPayoutEvidence.create({
      data: {
        transferId: transfer.id,
        attachmentPublicId: `${TAG}/persist`,
        attachmentResourceType: 'raw',
        attachmentName: 'slip.pdf',
        attachmentMimeType: 'application/pdf',
        attachmentBytes: 50,
        attachmentKind: 'document',
      },
    });
    await payouts.verifyTransfer(verifier, orderId, transfer.id, {
      notes: 'verified against bank app',
    });
    await payouts.startWork(artisan, orderId);

    // Simulate app restart: new Prisma client read.
    const fresh = new PrismaClient();
    try {
      const order = await fresh.order.findUniqueOrThrow({
        where: { id: orderId },
        include: {
          artisanPayout: {
            include: { transfers: { include: { evidence: true } }, events: true },
          },
          statusHistory: true,
        },
      });
      expect(order.productionStartedAt).toBeTruthy();
      expect(order.productionDeadline).toBeTruthy();
      expect(order.productionDurationDays).toBe(3);
      expect(order.artisanPayout?.status).toBe('verified');
      expect(order.artisanPayout?.transfers[0]?.externalReference).toBe(
        `${TAG}-persist-${orderId}`,
      );
      expect(order.artisanPayout?.transfers[0]?.evidence.length).toBeGreaterThan(0);
      expect(order.artisanPayout?.events.length).toBeGreaterThan(0);
      expect(order.statusHistory.some((h) => h.status === 'in_progress')).toBe(true);
    } finally {
      await fresh.$disconnect();
    }
  });
});
