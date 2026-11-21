/** Isolated PostgreSQL integration: no gateway, Cloudinary, bank, or live data. */
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { AdminCapabilitiesService } from '../auth/admin-capabilities.service';
import { PrismaService } from '../database/prisma.service';
import { ArtisanPayoutService } from '../orders/artisan-payout.service';
import { OrdersService } from '../orders/orders.service';
import { OrderReadinessService } from '../orders/order-readiness.service';
import { PaymentMethodsService } from '../payments/payment-methods.service';
import { TestOrderSimulationService } from './test-order-simulation.service';

const TAG = `sim-${Date.now()}`;
const dbUrl = (
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:5432/moe_dev?schema=public'
).replace('@localhost:', '@127.0.0.1:');
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
const prismaSvc = () => prisma as unknown as PrismaService;

describe('safe test order simulation (PostgreSQL)', () => {
  jest.setTimeout(120_000);
  let adminId = 0;
  let recorderId = 0;
  let verifierId = 0;
  let customerId = 0;
  let artisanId = 0;
  let productId = 0;
  let orderId = 0;
  let simulation: TestOrderSimulationService;
  let readiness: OrderReadinessService;
  let payouts: ArtisanPayoutService;
  let orders: OrdersService;

  const notifications = {
    notifyOrderCreated: jest.fn(async () => ({})),
    notifyOrderStatusChange: jest.fn(async () => ({})),
    notifyReadinessAssigned: jest.fn(async () => ({})),
    notifyReadinessApproved: jest.fn(async () => ({})),
    notifyReadinessChangesRequested: jest.fn(async () => ({})),
    notifyReadinessRejected: jest.fn(async () => ({})),
    notifyArtisanPayoutVerified: jest.fn(async () => ({})),
    notifyProductionStarted: jest.fn(async () => ({})),
  };

  const payload = (id: number, role: 'admin' | 'artisan' | 'customer') => ({
    sub: id,
    email: `${TAG}-${id}@local.test`,
    role,
  });

  beforeAll(async () => {
    await prisma.$connect();
    for (const name of ['admin', 'artisan', 'customer']) {
      await prisma.role.upsert({
        where: { name },
        update: {},
        create: { name },
      });
    }
    const adminRole = await prisma.role.findUniqueOrThrow({
      where: { name: 'admin' },
    });
    const artisanRole = await prisma.role.findUniqueOrThrow({
      where: { name: 'artisan' },
    });
    const customerRole = await prisma.role.findUniqueOrThrow({
      where: { name: 'customer' },
    });
    const passwordHash = 'test-only-not-used';
    const admin = await prisma.user.create({
      data: {
        name: `${TAG} admin`,
        email: `${TAG}-admin@local.test`,
        passwordHash,
        isTestUser: true,
        roles: { create: { roleId: adminRole.id } },
      },
    });
    const recorder = await prisma.user.create({
      data: {
        name: `${TAG} recorder`,
        email: `${TAG}-recorder@local.test`,
        passwordHash,
        isTestUser: true,
        adminCapabilities: ['payout_amount_approve', 'payout_transfer_record'],
        roles: { create: { roleId: adminRole.id } },
      },
    });
    const verifier = await prisma.user.create({
      data: {
        name: `${TAG} verifier`,
        email: `${TAG}-verifier@local.test`,
        passwordHash,
        isTestUser: true,
        adminCapabilities: ['payout_transfer_verify'],
        roles: { create: { roleId: adminRole.id } },
      },
    });
    const artisan = await prisma.user.create({
      data: {
        name: `${TAG} artisan`,
        email: `${TAG}-artisan@local.test`,
        passwordHash,
        isTestUser: true,
        roles: { create: { roleId: artisanRole.id } },
        artisanProfile: {
          create: { businessName: `${TAG} Studio`, status: 'approved' },
        },
      },
    });
    const customer = await prisma.user.create({
      data: {
        name: `${TAG} customer`,
        email: `${TAG}-customer@local.test`,
        passwordHash,
        isTestUser: true,
        roles: { create: { roleId: customerRole.id } },
      },
    });
    const product = await prisma.product.create({
      data: {
        name: `${TAG} Product`,
        description: 'Simulator fixture',
        price: 45000,
        currency: 'NGN',
        category: 'tailoring',
        images: [],
        providerId: artisan.id,
        status: 'approved',
      },
    });
    adminId = admin.id;
    recorderId = recorder.id;
    verifierId = verifier.id;
    artisanId = artisan.id;
    customerId = customer.id;
    productId = product.id;

    const databaseName = new URL(dbUrl).pathname.replace(/^\//, '');
    const values: Record<string, string> = {
      TEST_ORDER_SIMULATION_ENABLED: 'true',
      APP_ENV: 'test',
      NODE_ENV: 'test',
      DATABASE_URL: dbUrl,
      TEST_ORDER_SIMULATION_DATABASE_NAMES: databaseName,
      TEST_ORDER_SIMULATION_ADMIN_IDS: [adminId, recorderId, verifierId].join(
        ',',
      ),
      PAYMENT_MODE: 'test',
      PAYMENT_LIVE_ENABLED: 'false',
      INITIAL_PAYOUT_LIMITS_JSON: '{"NGN":{"maxAbsolute":50000}}',
    };
    const config = { get: (key: string) => values[key] } as ConfigService;
    const caps = new AdminCapabilitiesService(prismaSvc(), config);
    payouts = new ArtisanPayoutService(
      prismaSvc(),
      notifications as never,
      caps,
      config,
    );
    readiness = new OrderReadinessService(
      prismaSvc(),
      notifications as never,
      config,
      payouts,
    );
    orders = new OrdersService(
      prismaSvc(),
      notifications as never,
      new PaymentMethodsService(prismaSvc()),
      readiness,
      payouts,
    );
    simulation = new TestOrderSimulationService(
      prismaSvc(),
      config,
      orders,
      payouts,
    );
  });

  afterAll(async () => {
    if (orderId)
      await prisma.order
        .deleteMany({ where: { id: orderId } })
        .catch(() => undefined);
    await prisma.product
      .deleteMany({ where: { id: productId } })
      .catch(() => undefined);
    await prisma.artisanProfile
      .deleteMany({ where: { userId: artisanId } })
      .catch(() => undefined);
    const ids = [adminId, recorderId, verifierId, artisanId, customerId].filter(
      Boolean,
    );
    await prisma.userRole
      .deleteMany({ where: { userId: { in: ids } } })
      .catch(() => undefined);
    await prisma.user
      .deleteMany({ where: { id: { in: ids } } })
      .catch(() => undefined);
    await prisma.$disconnect();
  });

  it('creates an isolated marked order and preserves readiness and finance gates', async () => {
    const created = await simulation.create(payload(adminId, 'admin'), {
      productId,
      artisanId,
      customerId,
      quantity: 1,
    });
    orderId = created.id;
    const row = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { simulatedSettlement: true, paymentAttempts: true },
    });
    expect(row).toMatchObject({
      isTestOrder: true,
      paymentMethod: 'simulated',
      paymentReference: null,
      paymentStatus: 'paid',
      status: 'confirmed',
      simulatedPaymentStatus: 'succeeded',
    });
    expect(row.simulatedSettlement).toMatchObject({
      status: 'succeeded',
      customerId,
    });
    expect(row.paymentAttempts).toHaveLength(0);

    const newOrders = await orders.list(payload(artisanId, 'artisan'), {
      view: 'new',
    });
    expect(
      newOrders.data.some((order) => order.id === orderId && order.isTestOrder),
    ).toBe(true);

    await expect(
      payouts.startWork(payload(artisanId, 'artisan'), orderId),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'READINESS_NOT_APPROVED' }),
    });
    await prisma.order.update({
      where: { id: orderId },
      data: { readinessWorkflowStatus: 'submitted' },
    });
    const assessment = await prisma.orderReadinessAssessment.create({
      data: {
        orderId,
        version: 1,
        type: 'standard',
        status: 'submitted',
        artisanId,
        acknowledgedRequirements: true,
        submittedAt: new Date(),
        payload: {
          workDescription: 'Test production',
          specificationsConfirmed: true,
          materialsRequired: 'test material',
          skillsConfirmed: true,
          capacityConfirmed: true,
          estimatedMaterialCost: 10000,
          proposedProductionDays: 2,
          productionSteps: ['test cut', 'test finish'],
          matchesCustomerRequirements: true,
        },
      },
    });
    await readiness.adminDecide(
      payload(adminId, 'admin'),
      orderId,
      assessment.id,
      { decision: 'approve', reason: 'Test readiness approved' },
    );
    await payouts.approveAmount(payload(recorderId, 'admin'), orderId, {
      approvedAmount: 10000,
      currency: 'NGN',
      reason: 'Test materials',
    });

    await expect(
      payouts.startWork(payload(artisanId, 'artisan'), orderId),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PAYOUT_NOT_VERIFIED' }),
    });
    const transfer = await simulation.recordSimulatedPayout(
      payload(recorderId, 'admin'),
      orderId,
      { amount: 10000 },
    );
    expect(transfer).toMatchObject({ status: 'recorded', isSimulated: true });
    await expect(
      simulation.verifySimulatedPayout(
        payload(recorderId, 'admin'),
        orderId,
        transfer.id,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'FINANCE_CAPABILITY_REQUIRED',
      }),
    });
    await simulation.verifySimulatedPayout(
      payload(verifierId, 'admin'),
      orderId,
      transfer.id,
    );
    const started = await payouts.startWork(
      payload(artisanId, 'artisan'),
      orderId,
    );
    expect(started).toMatchObject({ alreadyStarted: false });

    const financial = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { artisanPayout: { include: { transfers: true } } },
    });
    expect(financial.artisanPayout).toMatchObject({
      isSimulated: true,
      status: 'verified',
    });
    expect(financial.artisanPayout?.transfers).toEqual([
      expect.objectContaining({
        isSimulated: true,
        status: 'verified',
        payeeDetails: 'SIMULATED PAYMENT — NO BANK ACCOUNT',
      }),
    ]);
  });
});
