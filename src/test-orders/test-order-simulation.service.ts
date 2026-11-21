import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { activeProductWhere } from '../common/active-product';
import { catalogueProviderFilter } from '../common/canonical-storefronts';
import { PrismaService } from '../database/prisma.service';
import { ArtisanPayoutService } from '../orders/artisan-payout.service';
import { CheckoutPaymentMethod } from '../orders/dto/create-order.dto';
import { OrdersService } from '../orders/orders.service';
import { assertTestOrderEnvironment } from './test-order-environment';

type CreateSimulationBody = {
  productId?: number;
  artisanId?: number;
  customerId?: number;
  quantity?: number;
  customisation?: Record<string, unknown>;
  selectedVariations?: Record<string, unknown>;
};

@Injectable()
export class TestOrderSimulationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly orders: OrdersService,
    private readonly payouts: ArtisanPayoutService,
  ) {}

  private assertAllowed(adminId: number) {
    return assertTestOrderEnvironment(this.config, adminId);
  }

  async configFor(admin: AccessTokenPayload) {
    const environment = this.assertAllowed(admin.sub);
    return {
      enabled: true,
      environment: environment.appEnv,
      database: environment.databaseName,
    };
  }

  async options(admin: AccessTokenPayload) {
    this.assertAllowed(admin.sub);
    const hiddenProviders = await catalogueProviderFilter(this.prisma);
    const [customers, artisans, products] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          isTestUser: true,
          status: 'active',
          roles: { some: { role: { name: 'customer' } } },
        },
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.user.findMany({
        where: {
          isTestUser: true,
          status: 'active',
          artisanProfile: { is: { status: 'approved' } },
          ...(hiddenProviders ? { id: hiddenProviders } : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          artisanProfile: { select: { brandName: true, businessName: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.product.findMany({
        where: {
          status: 'approved',
          ...activeProductWhere,
          provider: {
            isTestUser: true,
            artisanProfile: { is: { status: 'approved' } },
          },
          ...(hiddenProviders ? { providerId: hiddenProviders } : {}),
        },
        select: {
          id: true,
          name: true,
          price: true,
          currency: true,
          providerId: true,
          images: true,
          imageUrl: true,
        },
        orderBy: { name: 'asc' },
      }),
    ]);
    return { customers, artisans, products };
  }

  async create(admin: AccessTokenPayload, body: CreateSimulationBody) {
    this.assertAllowed(admin.sub);
    const productId = Number(body.productId);
    const artisanId = Number(body.artisanId);
    const customerId = Number(body.customerId);
    if (
      ![productId, artisanId, customerId].every(
        (id) => Number.isInteger(id) && id > 0,
      )
    ) {
      throw new BadRequestException({
        message: 'Test customer, artisan and product are required',
        code: 'VALIDATION_ERROR',
      });
    }

    const hiddenProviders = await catalogueProviderFilter(this.prisma);
    const [customer, artisan, product] = await Promise.all([
      this.prisma.user.findFirst({
        where: {
          id: customerId,
          isTestUser: true,
          status: 'active',
          roles: { some: { role: { name: 'customer' } } },
        },
      }),
      this.prisma.user.findFirst({
        where: {
          id: hiddenProviders
            ? { equals: artisanId, ...hiddenProviders }
            : artisanId,
          isTestUser: true,
          status: 'active',
          artisanProfile: { is: { status: 'approved' } },
        },
        include: { artisanProfile: true },
      }),
      this.prisma.product.findFirst({
        where: {
          id: productId,
          providerId: hiddenProviders
            ? { equals: artisanId, ...hiddenProviders }
            : artisanId,
          status: 'approved',
          ...activeProductWhere,
        },
      }),
    ]);
    if (!customer || !artisan || !product) {
      throw new BadRequestException({
        message:
          'Selections must be dedicated test users and an eligible product owned by the selected test artisan',
        code: 'TEST_FIXTURE_REQUIRED',
      });
    }

    const customerPayload: AccessTokenPayload = {
      sub: customer.id,
      email: customer.email,
      role: 'customer',
    };
    const testReference = `TEST-${randomUUID().toUpperCase()}`;
    const created = await this.orders.create(
      customerPayload,
      {
        items: [
          {
            productId: String(product.id),
            quantity: Math.max(1, Math.min(20, Number(body.quantity) || 1)),
            customisation: body.customisation,
            selectedVariations: body.selectedVariations,
          },
        ],
        shippingAddress: {
          firstName: 'TEST',
          lastName: 'CUSTOMER',
          phone: '+2348000000000',
          address: 'TEST ORDER - NO DELIVERY',
          city: 'Lagos Test',
          state: 'Lagos',
          country: 'NG',
        },
        paymentMethod: CheckoutPaymentMethod.COD,
        saveCard: false,
      },
      { isTestOrder: true, testReference },
    );
    const orderId = Number(created.id);
    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: {
          simulatedPaymentStatus: 'succeeded',
          paymentReference: null,
          paymentStatus: 'paid',
          status: 'confirmed',
        },
      }),
      this.prisma.simulatedPaymentSettlement.create({
        data: {
          orderId,
          customerId,
          amountMinor: Math.round((created.price ?? 0) * 100),
          currency: created.currency,
          status: 'succeeded',
          createdById: admin.sub,
        },
      }),
      this.prisma.orderStatusHistory.create({
        data: {
          orderId,
          status: 'confirmed',
          changedBy: admin.sub,
          note: 'SIMULATED PAYMENT — no gateway contacted',
        },
      }),
    ]);
    return this.getOne(admin, orderId);
  }

  async list(admin: AccessTokenPayload) {
    this.assertAllowed(admin.sub);
    const rows = await this.prisma.order.findMany({
      where: { isTestOrder: true },
      include: {
        simulatedSettlement: true,
        artisanPayout: {
          include: { transfers: { orderBy: { recordedAt: 'asc' } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((row) => this.toSummary(row));
  }

  async getOne(admin: AccessTokenPayload, orderId: number) {
    this.assertAllowed(admin.sub);
    const row = await this.prisma.order.findFirst({
      where: { id: orderId, isTestOrder: true },
      include: {
        simulatedSettlement: true,
        artisanPayout: {
          include: { transfers: { orderBy: { recordedAt: 'asc' } } },
        },
      },
    });
    if (!row)
      throw new NotFoundException({
        message: 'Test order not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    return this.toSummary(row);
  }

  async recordSimulatedPayout(
    admin: AccessTokenPayload,
    orderId: number,
    body: { amount?: number },
  ) {
    this.assertAllowed(admin.sub);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, isTestOrder: true },
      include: { artisanPayout: true },
    });
    if (!order?.artisanPayout)
      throw new BadRequestException({
        message: 'Approve the payout amount first',
        code: 'VALIDATION_ERROR',
      });
    const amount = Number(body.amount ?? order.artisanPayout.approvedAmount);
    const transfer = await this.payouts.recordTransfer(admin, orderId, {
      amount,
      currency: order.currency,
      transferDate: new Date().toISOString(),
      payeeName: 'TEST ARTISAN — NO REAL PAYEE',
      payeeDetails: 'SIMULATED PAYMENT — NO BANK ACCOUNT',
      externalReference: `SIM-${orderId}-${randomUUID()}`,
    });
    await this.prisma.$transaction([
      this.prisma.orderArtisanPayoutTransfer.update({
        where: { id: transfer.id },
        data: { isSimulated: true },
      }),
      this.prisma.orderArtisanPayoutEvidence.create({
        data: {
          transferId: transfer.id,
          attachmentPublicId: `test-simulation/${transfer.id}`,
          attachmentResourceType: 'raw',
          attachmentName: 'SIMULATED-PAYOUT.txt',
          attachmentMimeType: 'text/plain',
          attachmentBytes: 0,
          attachmentKind: 'document',
        },
      }),
    ]);
    return { ...transfer, isSimulated: true, label: 'SIMULATED PAYMENT' };
  }

  async verifySimulatedPayout(
    admin: AccessTokenPayload,
    orderId: number,
    transferId: number,
  ) {
    this.assertAllowed(admin.sub);
    const transfer = await this.prisma.orderArtisanPayoutTransfer.findFirst({
      where: {
        id: transferId,
        isSimulated: true,
        payout: { orderId, order: { isTestOrder: true } },
      },
    });
    if (!transfer)
      throw new NotFoundException({
        message: 'Simulated transfer not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    return this.payouts.verifyTransfer(admin, orderId, transferId, {
      notes: 'SIMULATED PAYMENT independently verified',
    });
  }

  async setTimeScenario(
    admin: AccessTokenPayload,
    orderId: number,
    scenario: string,
  ) {
    this.assertAllowed(admin.sub);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, isTestOrder: true },
    });
    if (!order)
      throw new NotFoundException({
        message: 'Test order not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    const now = new Date();
    if (scenario === 'readiness_24h_due') {
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          readinessResponseDeadline: new Date(now.getTime() - 60_000),
          simulationTimeScenario: scenario,
        },
      });
    } else if (scenario === 'production_overdue') {
      if (!order.productionStartedAt)
        throw new BadRequestException({
          message: 'Start production before applying this scenario',
          code: 'VALIDATION_ERROR',
        });
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          productionDeadline: new Date(now.getTime() - 60_000),
          simulationTimeScenario: scenario,
        },
      });
    } else if (scenario === 'delivery_review_72h_due') {
      if (
        !['delivered', 'delivery_disputed'].includes(
          order.fulfillmentStatus ?? '',
        )
      )
        throw new BadRequestException({
          message: 'Record delivery before applying this scenario',
          code: 'VALIDATION_ERROR',
        });
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          deliveredAt: new Date(now.getTime() - 73 * 60 * 60 * 1000),
          customerReviewDeadline: new Date(now.getTime() - 60_000),
          simulationTimeScenario: scenario,
        },
      });
    } else {
      throw new BadRequestException({
        message: 'Unsupported time scenario',
        code: 'VALIDATION_ERROR',
      });
    }
    return this.getOne(admin, orderId);
  }

  async cleanup(admin: AccessTokenPayload, orderId: number) {
    this.assertAllowed(admin.sub);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, isTestOrder: true },
      include: {
        paymentAttempts: true,
        artisanPayout: { include: { transfers: true } },
      },
    });
    if (!order)
      throw new NotFoundException({
        message: 'Test order not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    if (
      order.paymentAttempts.some((attempt) => !attempt.isSimulated) ||
      order.artisanPayout?.transfers.some((transfer) => !transfer.isSimulated)
    ) {
      throw new BadRequestException({
        message:
          'Cleanup blocked: order contains a non-simulated financial record',
        code: 'TEST_CLEANUP_BLOCKED',
      });
    }
    await this.prisma.$transaction([
      this.prisma.dispute.deleteMany({ where: { orderId } }),
      this.prisma.productReview.deleteMany({ where: { orderId } }),
      this.prisma.artisanReview.deleteMany({ where: { orderId } }),
      this.prisma.order.delete({ where: { id: orderId } }),
    ]);
    return { deleted: true, orderId };
  }

  private toSummary(row: any) {
    const transfers = row.artisanPayout?.transfers ?? [];
    return {
      id: row.id,
      testReference: row.testReference,
      label: 'TEST ORDER',
      customerId: row.customerId,
      artisanId: row.providerId,
      productId: row.productId,
      productName: row.productName,
      price: row.price,
      currency: row.currency,
      simulatedPaymentStatus: row.simulatedPaymentStatus,
      readinessStatus: row.readinessWorkflowStatus,
      initialPayoutStatus: row.artisanPayout?.status ?? null,
      productionStatus: row.productionStartedAt
        ? (row.qualityReviewStatus ?? 'in_production')
        : null,
      qualityStatus: row.qualityReviewStatus,
      deliveryStatus: row.fulfillmentStatus,
      finalPayoutStatus: transfers.some(
        (item: any) => item.milestoneId && item.status === 'verified',
      )
        ? 'verified'
        : row.finalPayoutReviewEligible
          ? 'eligible'
          : 'not_eligible',
      simulationTimeScenario: row.simulationTimeScenario,
      transfers: transfers.map((item: any) => ({
        id: item.id,
        amount: item.amount,
        currency: item.currency,
        status: item.status,
        isSimulated: item.isSimulated,
      })),
      createdAt: row.createdAt.toISOString(),
    };
  }
}
