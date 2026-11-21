import { ConfigService } from '@nestjs/config';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { TestOrderSimulationService } from './test-order-simulation.service';

const admin: AccessTokenPayload = {
  sub: 7,
  email: 'admin@test.local',
  role: 'admin',
};
const env = {
  TEST_ORDER_SIMULATION_ENABLED: 'true',
  APP_ENV: 'development',
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/moe_dev',
  TEST_ORDER_SIMULATION_DATABASE_NAMES: 'moe_dev',
  TEST_ORDER_SIMULATION_ADMIN_IDS: '7',
  PAYMENT_MODE: 'test',
  PAYMENT_LIVE_ENABLED: 'false',
};

describe('TestOrderSimulationService', () => {
  it('creates a marked settlement without invoking any gateway service', async () => {
    const now = new Date();
    const orderUpdate = jest.fn().mockResolvedValue({});
    const settlementCreate = jest.fn().mockResolvedValue({});
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: 20,
            name: 'TEST CUSTOMER',
            email: 'customer@test.local',
            isTestUser: true,
          })
          .mockResolvedValueOnce({
            id: 30,
            name: 'TEST ARTISAN',
            email: 'artisan@test.local',
            isTestUser: true,
            artisanProfile: { status: 'approved' },
          }),
      },
      product: {
        findFirst: jest.fn().mockResolvedValue({
          id: 40,
          name: 'Test Product',
          providerId: 30,
          status: 'approved',
          deletedAt: null,
        }),
      },
      order: {
        update: orderUpdate,
        findFirst: jest.fn().mockResolvedValue({
          id: 50,
          isTestOrder: true,
          testReference: 'TEST-50-X',
          customerId: 20,
          providerId: 30,
          productId: 40,
          productName: 'Test Product',
          price: 1000,
          currency: 'NGN',
          simulatedPaymentStatus: 'succeeded',
          readinessWorkflowStatus: 'awaiting_response',
          productionStartedAt: null,
          qualityReviewStatus: null,
          fulfillmentStatus: null,
          finalPayoutReviewEligible: false,
          simulationTimeScenario: null,
          simulatedSettlement: { status: 'succeeded' },
          artisanPayout: null,
          createdAt: now,
        }),
      },
      simulatedPaymentSettlement: { create: settlementCreate },
      orderStatusHistory: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(async (operations: Array<Promise<unknown>>) =>
        Promise.all(operations),
      ),
    };
    const orders = {
      create: jest
        .fn()
        .mockResolvedValue({ id: 50, price: 1000, currency: 'NGN' }),
    };
    const service = new TestOrderSimulationService(
      prisma as never,
      { get: (key: string) => env[key as keyof typeof env] } as ConfigService,
      orders as never,
      {} as never,
    );

    const result = await service.create(admin, {
      productId: 40,
      artisanId: 30,
      customerId: 20,
    });

    expect(orders.create).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 20, role: 'customer' }),
      expect.objectContaining({ paymentMethod: 'cod' }),
      expect.objectContaining({
        isTestOrder: true,
        testReference: expect.stringMatching(/^TEST-/),
      }),
    );
    expect(orderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentReference: null,
          paymentStatus: 'paid',
          simulatedPaymentStatus: 'succeeded',
        }),
      }),
    );
    expect(settlementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          gateway: expect.anything(),
          reference: expect.anything(),
        }),
      }),
    );
    expect(result.label).toBe('TEST ORDER');
  });
});
