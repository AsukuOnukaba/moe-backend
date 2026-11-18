import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AdminCapabilitiesService } from '../auth/admin-capabilities.service';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import {
  cloudinaryPublicId,
  cloudinaryResourceType,
} from '../upload/multer.config';
import { signedAuthenticatedUrl } from '../upload/cloudinary';
import type {
  ApprovePayoutAmountBody,
  DisputePayoutBody,
  MarkFundingNotRequiredBody,
  RecordPayoutTransferBody,
  VerifyPayoutTransferBody,
} from './dto/artisan-payout.dto';
import type { PayoutLimitsConfig, PayoutStatus } from './payout.constants';

const EPSILON = 0.009;

@Injectable()
export class ArtisanPayoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly capabilities: AdminCapabilitiesService,
    private readonly config: ConfigService,
  ) {}

  parseLimitsConfig(): {
    configured: boolean;
    limits: PayoutLimitsConfig;
  } {
    const raw = this.config.get<string>('INITIAL_PAYOUT_LIMITS_JSON');
    if (!raw?.trim()) return { configured: false, limits: {} };
    try {
      const parsed = JSON.parse(raw) as PayoutLimitsConfig;
      if (!parsed || typeof parsed !== 'object') {
        return { configured: false, limits: {} };
      }
      return { configured: true, limits: parsed };
    } catch {
      return { configured: false, limits: {} };
    }
  }

  evaluateLimit(params: {
    orderPrice: number | null;
    currency: string;
    approvedAmount: number;
  }): {
    withinLimit: boolean;
    policyStatus: 'configured' | 'missing' | 'exceeded_with_exception';
    maxAllowed: number | null;
    message: string | null;
  } {
    const { configured, limits } = this.parseLimitsConfig();
    const currency = (params.currency || 'NGN').toUpperCase();
    if (!configured || !limits[currency]) {
      return {
        withinLimit: false,
        policyStatus: 'missing',
        maxAllowed: null,
        message:
          'No initial payout funding limit policy is configured for this currency. Explicit authorised review with exceptionApproved + exceptionReason is required.',
      };
    }
    const rule = limits[currency];
    let maxAllowed: number | null = null;
    if (typeof rule.maxAbsolute === 'number' && Number.isFinite(rule.maxAbsolute)) {
      maxAllowed = rule.maxAbsolute;
    }
    if (
      typeof rule.maxRatio === 'number' &&
      Number.isFinite(rule.maxRatio) &&
      params.orderPrice != null &&
      params.orderPrice > 0
    ) {
      const byRatio = params.orderPrice * rule.maxRatio;
      maxAllowed = maxAllowed == null ? byRatio : Math.min(maxAllowed, byRatio);
    }
    if (maxAllowed == null) {
      return {
        withinLimit: false,
        policyStatus: 'missing',
        maxAllowed: null,
        message:
          'Funding limit rule exists but has no maxAbsolute/maxRatio. Explicit exception review is required.',
      };
    }
    if (params.approvedAmount <= maxAllowed + EPSILON) {
      return {
        withinLimit: true,
        policyStatus: 'configured',
        maxAllowed,
        message: null,
      };
    }
    return {
      withinLimit: false,
      policyStatus: 'exceeded_with_exception',
      maxAllowed,
      message: `Approved amount exceeds configured limit (${maxAllowed} ${currency}). exceptionApproved and exceptionReason are required.`,
    };
  }

  private moneyEq(a: number, b: number) {
    return Math.abs(a - b) <= EPSILON;
  }

  private verifiedTransferTotal(
    transfers: Array<{ amount: number; currency: string; status: string }>,
    currency: string,
  ) {
    return transfers
      .filter(
        (t) =>
          t.status === 'verified' &&
          t.currency.toUpperCase() === currency.toUpperCase(),
      )
      .reduce((sum, t) => sum + t.amount, 0);
  }

  /** Create payout shell after readiness approval (idempotent per order). */
  async ensurePayoutAfterReadinessApproval(params: {
    orderId: number;
    assessmentId: number | null;
    currency: string;
    payload: unknown;
    actorId: number;
  }) {
    const existing = await this.prisma.orderArtisanPayout.findUnique({
      where: { orderId: params.orderId },
    });
    if (existing) return existing;

    const payload =
      params.payload && typeof params.payload === 'object'
        ? (params.payload as Record<string, unknown>)
        : {};
    const requested =
      typeof payload.estimatedMaterialCost === 'number'
        ? payload.estimatedMaterialCost
        : null;

    return this.prisma.orderArtisanPayout.create({
      data: {
        orderId: params.orderId,
        assessmentId: params.assessmentId || null,
        currency: params.currency || 'NGN',
        requestedAmount: requested,
        status: 'requested',
        fundingRequired: true,
        events: {
          create: {
            orderId: params.orderId,
            actorId: params.actorId,
            action: 'payout_requested',
            detail: {
              assessmentId: params.assessmentId,
              requestedAmount: requested,
              source: 'readiness_approval',
            },
          },
        },
      },
    });
  }

  private evidenceDto(
    orderId: number,
    transferId: number,
    e: {
      id: number;
      attachmentPublicId: string;
      attachmentResourceType: string;
      attachmentName: string;
      attachmentMimeType: string;
      attachmentBytes: number | null;
      attachmentKind: string;
    },
  ) {
    return {
      id: e.id,
      name: e.attachmentName,
      mimeType: e.attachmentMimeType,
      bytes: e.attachmentBytes,
      kind: e.attachmentKind,
      url: `/orders/${orderId}/artisan-payout/transfers/${transferId}/evidence/${e.id}`,
    };
  }

  async getBundle(user: AccessTokenPayload, orderId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        artisanPayout: {
          include: {
            transfers: {
              include: { evidence: { orderBy: { id: 'asc' } } },
              orderBy: { id: 'asc' },
            },
            events: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });
    if (!order) {
      throw new NotFoundException({
        message: 'Order not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    if (user.role === 'admin') {
      /* ok */
    } else if (user.role === 'artisan' && order.providerId === user.sub) {
      /* ok */
    } else {
      throw new ForbiddenException({ message: 'Forbidden', code: 'FORBIDDEN' });
    }

    const payout = order.artisanPayout;
    const eligibility = await this.evaluateStartWorkEligibility(order);
    const { configured, limits } = this.parseLimitsConfig();

    return {
      orderId: order.id,
      readinessWorkflowStatus: order.readinessWorkflowStatus,
      productionStartedAt: order.productionStartedAt?.toISOString() ?? null,
      productionDeadline: order.productionDeadline?.toISOString() ?? null,
      productionDurationDays: order.productionDurationDays,
      customerPaymentStatus: order.paymentStatus,
      startWork: eligibility,
      limitPolicy: {
        configured,
        currencyRule: limits[(order.currency || 'NGN').toUpperCase()] ?? null,
      },
      payout: payout
        ? {
            id: payout.id,
            status: payout.status,
            currency: payout.currency,
            requestedAmount: payout.requestedAmount,
            approvedAmount: payout.approvedAmount,
            amountApprovedById: payout.amountApprovedById,
            amountApprovedAt: payout.amountApprovedAt?.toISOString() ?? null,
            amountApprovalReason: payout.amountApprovalReason,
            exceptionApproved: payout.exceptionApproved,
            exceptionReason: payout.exceptionReason,
            limitPolicyStatus: payout.limitPolicyStatus,
            fundingRequired: payout.fundingRequired,
            disputeFlag: payout.disputeFlag,
            disputeNotes: payout.disputeNotes,
            verifiedTotal: this.verifiedTransferTotal(
              payout.transfers,
              payout.currency,
            ),
            transfers: payout.transfers.map((t) => ({
              id: t.id,
              amount: t.amount,
              currency: t.currency,
              transferDate: t.transferDate.toISOString(),
              payeeName: t.payeeName,
              payeeDetails: t.payeeDetails,
              externalReference: t.externalReference,
              status: t.status,
              recordedById: t.recordedById,
              recordedAt: t.recordedAt.toISOString(),
              verifiedById: t.verifiedById,
              verifiedAt: t.verifiedAt?.toISOString() ?? null,
              verificationNotes: t.verificationNotes,
              rejectionReason: t.rejectionReason,
              evidence: t.evidence.map((e) =>
                this.evidenceDto(orderId, t.id, e),
              ),
            })),
            events: payout.events.map((ev) => ({
              id: ev.id,
              action: ev.action,
              actorId: ev.actorId,
              detail: ev.detail,
              createdAt: ev.createdAt.toISOString(),
            })),
          }
        : null,
    };
  }

  async getEvidenceAccess(
    user: AccessTokenPayload,
    orderId: number,
    transferId: number,
    evidenceId: number,
  ) {
    await this.getBundle(user, orderId);
    const evidence = await this.prisma.orderArtisanPayoutEvidence.findFirst({
      where: {
        id: evidenceId,
        transferId,
        transfer: { payout: { orderId } },
      },
    });
    if (!evidence) {
      throw new NotFoundException({
        message: 'Evidence not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    return {
      url: signedAuthenticatedUrl(
        evidence.attachmentPublicId,
        evidence.attachmentResourceType,
      ),
    };
  }

  payoutSummaryForOrder(order: {
    readinessWorkflowStatus: string | null;
    productionStartedAt: Date | null;
    productionDeadline: Date | null;
    productionOriginalDeadline?: Date | null;
    productionDurationDays: number | null;
    qualityReviewStatus?: string | null;
    fulfillmentStatus?: string | null;
    customerRating?: number | null;
    customerReview?: string | null;
    artisanPayout?: {
      status: string;
      fundingRequired: boolean;
      requestedAmount: number | null;
      approvedAmount: number | null;
      currency: string;
      disputeFlag: boolean;
      transfers?: Array<{ amount: number; currency: string; status: string }>;
    } | null;
  }) {
    if (!order.readinessWorkflowStatus) return null;
    const payout = order.artisanPayout ?? null;
    const verifiedTotal = payout?.transfers
      ? this.verifiedTransferTotal(payout.transfers, payout.currency)
      : 0;
    const fundingOk =
      !!payout &&
      (payout.status === 'not_required' ||
        (payout.status === 'verified' &&
          payout.fundingRequired &&
          payout.approvedAmount != null &&
          verifiedTotal + EPSILON >= payout.approvedAmount &&
          !payout.disputeFlag));
    const readyToStart =
      order.readinessWorkflowStatus === 'approved' &&
      fundingOk &&
      !order.productionStartedAt;
    const now = Date.now();
    const startedMs = order.productionStartedAt?.getTime() ?? null;
    const deadlineMs = order.productionDeadline?.getTime() ?? null;
    return {
      payoutStatus: (payout?.status as PayoutStatus | undefined) ?? null,
      fundingRequired: payout?.fundingRequired ?? true,
      requestedAmount: payout?.requestedAmount ?? null,
      approvedAmount: payout?.approvedAmount ?? null,
      currency: payout?.currency ?? null,
      verifiedTotal,
      disputeFlag: payout?.disputeFlag ?? false,
      productionStartedAt: order.productionStartedAt?.toISOString() ?? null,
      productionDeadline: order.productionDeadline?.toISOString() ?? null,
      productionOriginalDeadline:
        order.productionOriginalDeadline?.toISOString() ??
        order.productionDeadline?.toISOString() ??
        null,
      productionDurationDays: order.productionDurationDays ?? null,
      msElapsed: startedMs != null ? Math.max(0, now - startedMs) : null,
      msRemaining: deadlineMs != null ? deadlineMs - now : null,
      overdue: deadlineMs != null ? deadlineMs <= now : false,
      qualityReviewStatus: order.qualityReviewStatus ?? null,
      fulfillmentStatus: order.fulfillmentStatus ?? null,
      customerRating: order.customerRating ?? null,
      customerReview: order.customerReview ?? null,
      awaitingInitialPayout:
        order.readinessWorkflowStatus === 'approved' &&
        !fundingOk &&
        !order.productionStartedAt,
      readyToStart,
      displayLabel: order.productionStartedAt
        ? order.qualityReviewStatus === 'submitted'
          ? 'Quality review'
          : order.qualityReviewStatus === 'changes_requested'
            ? 'Rework requested'
            : order.fulfillmentStatus
              ? order.fulfillmentStatus.replace(/_/g, ' ')
              : 'In production'
        : readyToStart
          ? 'Ready to Start'
          : order.readinessWorkflowStatus === 'approved'
            ? 'Approved — Awaiting Initial Payout'
            : null,
    };
  }

  async evaluateStartWorkEligibility(order: {
    id: number;
    providerId: number | null;
    status: string;
    paymentStatus: string;
    paymentMethod: string;
    readinessWorkflowStatus: string | null;
    productionStartedAt: Date | null;
    productionDeadline: Date | null;
    productionDurationDays: number | null;
    currency: string;
    artisanPayout?: {
      status: string;
      fundingRequired: boolean;
      approvedAmount: number | null;
      currency: string;
      disputeFlag: boolean;
      transfers: Array<{ amount: number; currency: string; status: string }>;
    } | null;
  }): Promise<{
    eligible: boolean;
    reason: string | null;
    code: string | null;
    alreadyStarted: boolean;
  }> {
    if (!order.readinessWorkflowStatus) {
      return {
        eligible: true,
        reason: null,
        code: null,
        alreadyStarted: !!order.productionStartedAt,
      };
    }

    if (order.productionStartedAt) {
      return {
        eligible: true,
        reason: null,
        code: null,
        alreadyStarted: true,
      };
    }

    if (order.readinessWorkflowStatus !== 'approved') {
      return {
        eligible: false,
        reason: 'Readiness must be approved before Start Work',
        code: 'READINESS_NOT_APPROVED',
        alreadyStarted: false,
      };
    }

    if (!['confirmed', 'pending'].includes(order.status)) {
      return {
        eligible: false,
        reason: `Order status "${order.status}" cannot start production`,
        code: 'INVALID_ORDER_STATUS',
        alreadyStarted: false,
      };
    }

    // Customer payment: card/gateway must be paid; COD/bank_transfer may proceed when confirmed/pending.
    const method = (order.paymentMethod || '').toLowerCase();
    const gatewayLike =
      method.includes('card') ||
      method.includes('paystack') ||
      method.includes('flutterwave') ||
      method === 'gateway';
    if (gatewayLike && order.paymentStatus !== 'paid') {
      return {
        eligible: false,
        reason: 'Customer payment must be settled before Start Work',
        code: 'CUSTOMER_PAYMENT_REQUIRED',
        alreadyStarted: false,
      };
    }

    const payout =
      order.artisanPayout ??
      (await this.prisma.orderArtisanPayout.findUnique({
        where: { orderId: order.id },
        include: { transfers: true },
      }));

    if (!payout) {
      return {
        eligible: false,
        reason: 'Initial artisan payout record is missing',
        code: 'PAYOUT_MISSING',
        alreadyStarted: false,
      };
    }

    if (payout.disputeFlag || payout.status === 'disputed') {
      return {
        eligible: false,
        reason: 'Artisan payout is disputed',
        code: 'PAYOUT_DISPUTED',
        alreadyStarted: false,
      };
    }

    if (payout.status === 'reversed') {
      return {
        eligible: false,
        reason: 'Artisan payout was reversed',
        code: 'PAYOUT_REVERSED',
        alreadyStarted: false,
      };
    }

    if (payout.status === 'not_required' && !payout.fundingRequired) {
      return {
        eligible: true,
        reason: null,
        code: null,
        alreadyStarted: false,
      };
    }

    if (payout.approvedAmount == null && payout.status !== 'not_required') {
      return {
        eligible: false,
        reason: 'Approved payout amount is missing',
        code: 'PAYOUT_AMOUNT_MISSING',
        alreadyStarted: false,
      };
    }

    const verifiedTotal = this.verifiedTransferTotal(
      payout.transfers,
      payout.currency,
    );

    if (
      payout.approvedAmount != null &&
      verifiedTotal > 0 &&
      verifiedTotal + EPSILON < payout.approvedAmount
    ) {
      return {
        eligible: false,
        reason: `Verified funding (${verifiedTotal}) is below approved amount (${payout.approvedAmount})`,
        code: 'PAYOUT_INSUFFICIENT',
        alreadyStarted: false,
      };
    }

    if (payout.status !== 'verified') {
      return {
        eligible: false,
        reason:
          payout.status === 'recorded'
            ? 'Transfers are recorded but not yet independently verified'
            : 'Initial artisan payout is not verified',
        code: 'PAYOUT_NOT_VERIFIED',
        alreadyStarted: false,
      };
    }

    if (payout.approvedAmount == null) {
      return {
        eligible: false,
        reason: 'Approved payout amount is missing',
        code: 'PAYOUT_AMOUNT_MISSING',
        alreadyStarted: false,
      };
    }

    if (verifiedTotal + EPSILON < payout.approvedAmount) {
      return {
        eligible: false,
        reason: `Verified funding (${verifiedTotal}) is below approved amount (${payout.approvedAmount})`,
        code: 'PAYOUT_INSUFFICIENT',
        alreadyStarted: false,
      };
    }

    const hasBlockingTransfer = payout.transfers.some((t) =>
      ['disputed', 'reversed'].includes(t.status),
    );
    if (hasBlockingTransfer && verifiedTotal + EPSILON < payout.approvedAmount) {
      return {
        eligible: false,
        reason: 'Disputed or reversed transfers leave funding insufficient',
        code: 'PAYOUT_BLOCKED',
        alreadyStarted: false,
      };
    }

    return {
      eligible: true,
      reason: null,
      code: null,
      alreadyStarted: false,
    };
  }

  /**
   * Blocks patchStatus/adminPatch from setting in_progress on readiness orders
   * unless Start Work has already authorised production.
   */
  async assertProductionStartAllowed(order: {
    id: number;
    readinessWorkflowStatus: string | null;
    productionStartedAt: Date | null;
  }) {
    if (!order.readinessWorkflowStatus) return;
    if (order.productionStartedAt) return;
    throw new BadRequestException({
      message:
        'Use POST /orders/:id/start-work after readiness approval and verified initial artisan payout. Manual status change to in_progress is not permitted for readiness orders.',
      code: 'READINESS_PRODUCTION_BLOCKED',
    });
  }

  async approveAmount(
    admin: AccessTokenPayload,
    orderId: number,
    body: ApprovePayoutAmountBody,
  ) {
    await this.capabilities.assertCapability(admin.sub, 'payout_amount_approve');
    if (
      typeof body.approvedAmount !== 'number' ||
      !Number.isFinite(body.approvedAmount) ||
      body.approvedAmount < 0
    ) {
      throw new BadRequestException({
        message: 'approvedAmount must be a non-negative number',
        code: 'VALIDATION_ERROR',
      });
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { artisanPayout: true },
    });
    if (!order?.readinessWorkflowStatus) {
      throw new BadRequestException({
        message: 'Order is not in the readiness workflow',
        code: 'VALIDATION_ERROR',
      });
    }
    if (order.readinessWorkflowStatus !== 'approved') {
      throw new BadRequestException({
        message: 'Readiness must be approved before approving payout amount',
        code: 'VALIDATION_ERROR',
      });
    }

    let payout = order.artisanPayout;
    if (!payout) {
      const assessment = await this.prisma.orderReadinessAssessment.findFirst({
        where: { orderId, status: 'approved' },
        orderBy: { version: 'desc' },
      });
      payout = await this.ensurePayoutAfterReadinessApproval({
        orderId,
        assessmentId: assessment?.id ?? null,
        currency: body.currency || order.currency || 'NGN',
        payload: assessment?.payload ?? {},
        actorId: admin.sub,
      });
    }

    if (['verified', 'not_required'].includes(payout.status) && !payout.disputeFlag) {
      throw new ConflictException({
        message: `Cannot re-approve amount while payout status is "${payout.status}"`,
        code: 'CONFLICT',
      });
    }

    const currency = (body.currency || payout.currency || order.currency || 'NGN').toUpperCase();
    const limit = this.evaluateLimit({
      orderPrice: order.price,
      currency,
      approvedAmount: body.approvedAmount,
    });

    if (!limit.withinLimit) {
      if (!body.exceptionApproved || !body.exceptionReason?.trim()) {
        throw new BadRequestException({
          message: limit.message,
          code:
            limit.policyStatus === 'missing'
              ? 'PAYOUT_LIMIT_POLICY_MISSING'
              : 'PAYOUT_LIMIT_EXCEEDED',
          maxAllowed: limit.maxAllowed,
          policyStatus: limit.policyStatus,
        });
      }
    }

    const updated = await this.prisma.orderArtisanPayout.update({
      where: { id: payout.id },
      data: {
        approvedAmount: body.approvedAmount,
        currency,
        amountApprovedById: admin.sub,
        amountApprovedAt: new Date(),
        amountApprovalReason: body.reason?.trim() || null,
        exceptionApproved: !!body.exceptionApproved && !limit.withinLimit,
        exceptionReason:
          !!body.exceptionApproved && !limit.withinLimit
            ? body.exceptionReason?.trim() || null
            : null,
        limitPolicyStatus: limit.withinLimit
          ? 'configured'
          : body.exceptionApproved
            ? limit.policyStatus === 'missing'
              ? 'missing'
              : 'exceeded_with_exception'
            : limit.policyStatus,
        fundingRequired: body.approvedAmount > 0,
        status:
          body.approvedAmount === 0
            ? 'amount_approved'
            : 'amount_approved',
        events: {
          create: {
            orderId,
            actorId: admin.sub,
            action: 'amount_approved',
            detail: {
              approvedAmount: body.approvedAmount,
              currency,
              reason: body.reason?.trim() || null,
              exceptionApproved: !!body.exceptionApproved,
              exceptionReason: body.exceptionReason?.trim() || null,
              limitPolicyStatus: limit.policyStatus,
              maxAllowed: limit.maxAllowed,
            },
          },
        },
      },
    });

    // Mirror initial funding as milestone row (idempotent helpers live in milestone service).
    const existingInitial = await this.prisma.orderArtisanPayoutMilestone.findFirst({
      where: { payoutId: updated.id, kind: 'initial' },
    });
    if (!existingInitial && body.approvedAmount > 0) {
      await this.prisma.orderArtisanPayoutMilestone.create({
        data: {
          payoutId: updated.id,
          kind: 'initial',
          name: 'Initial material funding',
          description: 'Initial artisan payout',
          sequence: 0,
          approvedAmount: body.approvedAmount,
          currency,
          status: 'amount_approved',
          amountApprovedById: admin.sub,
          amountApprovedAt: new Date(),
          eligibleAt: new Date(),
        },
      });
    }

    return updated;
  }

  /**
   * Audited path for standard in-stock orders that need no production funding.
   * Custom / high-value / detailed material-cost orders cannot use this bypass.
   */
  async markFundingNotRequired(
    admin: AccessTokenPayload,
    orderId: number,
    body: MarkFundingNotRequiredBody,
  ) {
    await this.capabilities.assertCapability(
      admin.sub,
      'payout_mark_not_required',
    );
    if (!body.reason?.trim()) {
      throw new BadRequestException({
        message: 'reason is required for non-production funding path',
        code: 'VALIDATION_ERROR',
      });
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        artisanPayout: true,
        readinessAssessments: {
          where: { status: 'approved' },
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });
    if (!order || order.readinessWorkflowStatus !== 'approved') {
      throw new BadRequestException({
        message: 'Readiness must be approved',
        code: 'VALIDATION_ERROR',
      });
    }
    if (order.productionStartedAt) {
      throw new ConflictException({
        message: 'Production already started',
        code: 'CONFLICT',
      });
    }

    const assessment = order.readinessAssessments[0];
    const payload =
      assessment?.payload && typeof assessment.payload === 'object'
        ? (assessment.payload as Record<string, unknown>)
        : {};
    const requested =
      typeof payload.estimatedMaterialCost === 'number'
        ? payload.estimatedMaterialCost
        : order.artisanPayout?.requestedAmount;
    const isDetailed = assessment?.type === 'detailed';
    const mandatoryFunding =
      order.isCustomOrder ||
      isDetailed ||
      (typeof requested === 'number' && requested > 0) ||
      !!order.highValueOverride;

    if (mandatoryFunding) {
      throw new BadRequestException({
        message:
          'Funding-not-required is only allowed for standard in-stock orders without production material funding. Custom, detailed, or material-cost orders require verified initial payout.',
        code: 'FUNDING_REQUIRED',
      });
    }

    let payout = order.artisanPayout;
    if (!payout) {
      const assessment = await this.prisma.orderReadinessAssessment.findFirst({
        where: { orderId, status: 'approved' },
        orderBy: { version: 'desc' },
      });
      payout = await this.ensurePayoutAfterReadinessApproval({
        orderId,
        assessmentId: assessment?.id ?? null,
        currency: order.currency || 'NGN',
        payload: assessment?.payload ?? {},
        actorId: admin.sub,
      });
    }

    return this.prisma.orderArtisanPayout.update({
      where: { id: payout.id },
      data: {
        fundingRequired: false,
        approvedAmount: 0,
        amountApprovedById: admin.sub,
        amountApprovedAt: new Date(),
        amountApprovalReason: body.reason.trim(),
        limitPolicyStatus: 'not_applicable',
        status: 'not_required',
        disputeFlag: false,
        disputeNotes: null,
        events: {
          create: {
            orderId,
            actorId: admin.sub,
            action: 'funding_not_required',
            detail: { reason: body.reason.trim() },
          },
        },
      },
    });
  }

  async recordTransfer(
    admin: AccessTokenPayload,
    orderId: number,
    body: RecordPayoutTransferBody,
    files: Express.Multer.File[] = [],
  ) {
    await this.capabilities.assertCapability(admin.sub, 'payout_transfer_record');

    if (
      typeof body.amount !== 'number' ||
      !Number.isFinite(body.amount) ||
      body.amount <= 0
    ) {
      throw new BadRequestException({
        message: 'amount must be a positive number',
        code: 'VALIDATION_ERROR',
      });
    }
    if (!body.externalReference?.trim()) {
      throw new BadRequestException({
        message: 'externalReference is required',
        code: 'VALIDATION_ERROR',
      });
    }
    if (!body.payeeName?.trim()) {
      throw new BadRequestException({
        message: 'payeeName is required',
        code: 'VALIDATION_ERROR',
      });
    }
    const transferDate = new Date(body.transferDate);
    if (Number.isNaN(transferDate.getTime())) {
      throw new BadRequestException({
        message: 'transferDate must be a valid ISO date',
        code: 'VALIDATION_ERROR',
      });
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { artisanPayout: true },
    });
    if (!order?.artisanPayout) {
      throw new BadRequestException({
        message: 'Approve payout amount before recording a transfer',
        code: 'VALIDATION_ERROR',
      });
    }
    const payout = order.artisanPayout;
    if (!payout.fundingRequired || payout.status === 'not_required') {
      throw new BadRequestException({
        message: 'Funding is marked not required for this order',
        code: 'VALIDATION_ERROR',
      });
    }
    if (!['amount_approved', 'recorded', 'verified'].includes(payout.status)) {
      throw new BadRequestException({
        message: `Cannot record transfer while payout status is "${payout.status}"`,
        code: 'VALIDATION_ERROR',
      });
    }
    if (payout.approvedAmount == null) {
      throw new BadRequestException({
        message: 'Approved amount is required before recording transfers',
        code: 'VALIDATION_ERROR',
      });
    }

    const currency = (body.currency || payout.currency).toUpperCase();
    if (currency !== payout.currency.toUpperCase()) {
      throw new BadRequestException({
        message: `Transfer currency must match approved currency (${payout.currency})`,
        code: 'VALIDATION_ERROR',
      });
    }

    const ref = body.externalReference.trim();
    try {
      const transfer = await this.prisma.$transaction(async (tx) => {
        const created = await tx.orderArtisanPayoutTransfer.create({
          data: {
            payoutId: payout.id,
            amount: body.amount,
            currency,
            transferDate,
            payeeName: body.payeeName.trim(),
            payeeDetails: body.payeeDetails?.trim() || null,
            externalReference: ref,
            status: 'recorded',
            recordedById: admin.sub,
            evidence: {
              create: (files ?? []).map((file) => ({
                attachmentPublicId: cloudinaryPublicId(file),
                attachmentResourceType: cloudinaryResourceType(
                  file,
                  file.mimetype,
                ),
                attachmentName: file.originalname || 'evidence',
                attachmentMimeType: file.mimetype || 'application/octet-stream',
                attachmentBytes: file.size ?? null,
                attachmentKind: (file.mimetype || '').startsWith('image/')
                  ? 'image'
                  : 'document',
              })),
            },
          },
          include: { evidence: true },
        });

        await tx.orderArtisanPayout.update({
          where: { id: payout.id },
          data: {
            status: payout.status === 'verified' ? 'verified' : 'recorded',
            events: {
              create: {
                orderId,
                actorId: admin.sub,
                action: 'transfer_recorded',
                detail: {
                  transferId: created.id,
                  amount: body.amount,
                  currency,
                  externalReference: ref,
                  // Recording alone never unlocks Start Work.
                  unlocksStartWork: false,
                },
              },
            },
          },
        });

        return created;
      });

      return transfer;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException({
          message: 'Duplicate transfer reference',
          code: 'DUPLICATE_TRANSFER_REFERENCE',
        });
      }
      throw err;
    }
  }

  async verifyTransfer(
    admin: AccessTokenPayload,
    orderId: number,
    transferId: number,
    body: VerifyPayoutTransferBody,
    files: Express.Multer.File[] = [],
  ) {
    await this.capabilities.assertCapability(admin.sub, 'payout_transfer_verify');
    if (!body.notes?.trim()) {
      throw new BadRequestException({
        message: 'verification notes are required',
        code: 'VALIDATION_ERROR',
      });
    }

    const transfer = await this.prisma.orderArtisanPayoutTransfer.findFirst({
      where: { id: transferId, payout: { orderId } },
      include: {
        evidence: true,
        payout: { include: { transfers: true } },
      },
    });
    if (!transfer) {
      throw new NotFoundException({
        message: 'Transfer not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    if (transfer.status === 'verified') {
      throw new ConflictException({
        message: 'Transfer already verified',
        code: 'DUPLICATE_VERIFICATION',
      });
    }
    if (transfer.status !== 'recorded') {
      throw new BadRequestException({
        message: `Cannot verify transfer in status "${transfer.status}"`,
        code: 'VALIDATION_ERROR',
      });
    }
    if (transfer.recordedById === admin.sub) {
      throw new ForbiddenException({
        message: 'Recorder cannot verify their own transfer',
        code: 'RECORDER_CANNOT_VERIFY',
      });
    }

    const evidenceCount = transfer.evidence.length + (files?.length ?? 0);
    if (evidenceCount < 1) {
      throw new BadRequestException({
        message:
          'Independent supporting evidence is required to verify a transfer (attach proof or ensure record has evidence)',
        code: 'EVIDENCE_REQUIRED',
      });
    }

    const payout = transfer.payout;
    if (payout.approvedAmount == null) {
      throw new BadRequestException({
        message: 'Approved amount missing',
        code: 'VALIDATION_ERROR',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      if (files?.length) {
        await tx.orderArtisanPayoutEvidence.createMany({
          data: files.map((file) => ({
            transferId: transfer.id,
            attachmentPublicId: cloudinaryPublicId(file),
            attachmentResourceType: cloudinaryResourceType(file, file.mimetype),
            attachmentName: file.originalname || 'evidence',
            attachmentMimeType: file.mimetype || 'application/octet-stream',
            attachmentBytes: file.size ?? null,
            attachmentKind: (file.mimetype || '').startsWith('image/')
              ? 'image'
              : 'document',
          })),
        });
      }

      await tx.orderArtisanPayoutTransfer.update({
        where: { id: transfer.id },
        data: {
          status: 'verified',
          verifiedById: admin.sub,
          verifiedAt: new Date(),
          verificationNotes: body.notes.trim(),
        },
      });

      const allTransfers = await tx.orderArtisanPayoutTransfer.findMany({
        where: { payoutId: payout.id },
      });
      const verifiedTotal = this.verifiedTransferTotal(
        allTransfers,
        payout.currency,
      );
      const funded = verifiedTotal + EPSILON >= payout.approvedAmount!;
      const nextStatus: PayoutStatus = funded ? 'verified' : 'recorded';

      await tx.orderArtisanPayout.update({
        where: { id: payout.id },
        data: {
          status: nextStatus,
          events: {
            create: {
              orderId,
              actorId: admin.sub,
              action: 'transfer_verified',
              detail: {
                transferId: transfer.id,
                verifiedTotal,
                approvedAmount: payout.approvedAmount,
                unlocksStartWork: funded,
              },
            },
          },
        },
      });

      if (funded && payout.orderId) {
        const ord = await tx.order.findUnique({ where: { id: orderId } });
        if (ord?.providerId) {
          // notify outside tx below
        }
      }

      return {
        transferId: transfer.id,
        payoutStatus: nextStatus,
        verifiedTotal,
        unlocksStartWork: funded,
        providerId: (await tx.order.findUnique({ where: { id: orderId } }))
          ?.providerId,
        productName: (await tx.order.findUnique({ where: { id: orderId } }))
          ?.productName,
      };
    }).then(async (result) => {
      if (result.unlocksStartWork && result.providerId) {
        await this.notifications.notifyArtisanPayoutVerified(
          result.providerId,
          orderId,
          result.productName ?? `Order #${orderId}`,
        );
      }
      return result;
    });
  }

  async rejectTransfer(
    admin: AccessTokenPayload,
    orderId: number,
    transferId: number,
    body: { reason: string },
  ) {
    await this.capabilities.assertCapability(admin.sub, 'payout_transfer_verify');
    if (!body.reason?.trim()) {
      throw new BadRequestException({
        message: 'reason is required',
        code: 'VALIDATION_ERROR',
      });
    }
    const transfer = await this.prisma.orderArtisanPayoutTransfer.findFirst({
      where: { id: transferId, payout: { orderId } },
    });
    if (!transfer) {
      throw new NotFoundException({
        message: 'Transfer not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    if (transfer.status !== 'recorded') {
      throw new BadRequestException({
        message: `Cannot reject transfer in status "${transfer.status}"`,
        code: 'VALIDATION_ERROR',
      });
    }
    if (transfer.recordedById === admin.sub) {
      throw new ForbiddenException({
        message: 'Recorder cannot reject/verify their own transfer',
        code: 'RECORDER_CANNOT_VERIFY',
      });
    }

    await this.prisma.orderArtisanPayoutTransfer.update({
      where: { id: transfer.id },
      data: {
        status: 'rejected',
        verifiedById: admin.sub,
        verifiedAt: new Date(),
        rejectionReason: body.reason.trim(),
      },
    });
    await this.prisma.orderArtisanPayoutEvent.create({
      data: {
        payoutId: transfer.payoutId,
        orderId,
        actorId: admin.sub,
        action: 'transfer_rejected',
        detail: { transferId, reason: body.reason.trim() },
      },
    });
    return { transferId, status: 'rejected' };
  }

  async disputeOrReverse(
    admin: AccessTokenPayload,
    orderId: number,
    body: DisputePayoutBody,
  ) {
    await this.capabilities.assertCapability(admin.sub, 'payout_dispute');
    if (!body.notes?.trim()) {
      throw new BadRequestException({
        message: 'notes are required',
        code: 'VALIDATION_ERROR',
      });
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { artisanPayout: { include: { transfers: true } } },
    });
    if (!order?.artisanPayout) {
      throw new NotFoundException({
        message: 'Payout not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    const reverse = !!body.reverse;
    const nextStatus: PayoutStatus = reverse ? 'reversed' : 'disputed';

    if (body.transferId) {
      const t = order.artisanPayout.transfers.find((x) => x.id === body.transferId);
      if (!t) {
        throw new NotFoundException({
          message: 'Transfer not found',
          code: 'RESOURCE_NOT_FOUND',
        });
      }
      await this.prisma.orderArtisanPayoutTransfer.update({
        where: { id: t.id },
        data: { status: reverse ? 'reversed' : 'disputed' },
      });
    }

    const productionStarted = !!order.productionStartedAt;

    await this.prisma.orderArtisanPayout.update({
      where: { id: order.artisanPayout.id },
      data: {
        status: nextStatus,
        disputeFlag: true,
        disputeNotes: body.notes.trim(),
        events: {
          create: {
            orderId,
            actorId: admin.sub,
            action: reverse ? 'reversed' : 'disputed',
            detail: {
              notes: body.notes.trim(),
              transferId: body.transferId ?? null,
              productionAlreadyStarted: productionStarted,
              // Never silently reset production history.
              productionStartedAt: order.productionStartedAt?.toISOString() ?? null,
            },
          },
        },
      },
    });

    return {
      orderId,
      payoutStatus: nextStatus,
      productionStarted,
      startWorkRevoked: !productionStarted,
    };
  }

  async startWork(user: AccessTokenPayload, orderId: number) {
    if (user.role !== 'artisan' && user.role !== 'admin') {
      throw new ForbiddenException({ message: 'Forbidden', code: 'FORBIDDEN' });
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        artisanPayout: { include: { transfers: true } },
        readinessAssessments: {
          where: { status: 'approved' },
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });
    if (!order) {
      throw new NotFoundException({
        message: 'Order not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    if (user.role === 'artisan' && order.providerId !== user.sub) {
      throw new ForbiddenException({ message: 'Forbidden', code: 'FORBIDDEN' });
    }

    // Legacy: no readiness — keep existing patchStatus path; do not invent production fields.
    if (!order.readinessWorkflowStatus) {
      throw new BadRequestException({
        message:
          'Start Work endpoint is for readiness-workflow orders. Legacy orders use status transitions.',
        code: 'LEGACY_ORDER',
      });
    }

    if (order.productionStartedAt) {
      return {
        orderId: order.id,
        alreadyStarted: true,
        productionStartedAt: order.productionStartedAt.toISOString(),
        productionDeadline: order.productionDeadline?.toISOString() ?? null,
        status: order.status,
      };
    }

    const eligibility = await this.evaluateStartWorkEligibility(order);
    if (!eligibility.eligible) {
      throw new BadRequestException({
        message: eligibility.reason ?? 'Not eligible to start work',
        code: eligibility.code ?? 'START_WORK_BLOCKED',
      });
    }

    const assessment = order.readinessAssessments[0];
    const payload =
      assessment?.payload && typeof assessment.payload === 'object'
        ? (assessment.payload as Record<string, unknown>)
        : {};
    const daysRaw = payload.proposedProductionDays;
    const durationDays =
      typeof daysRaw === 'number' && daysRaw > 0
        ? Math.ceil(daysRaw)
        : typeof daysRaw === 'string' && Number(daysRaw) > 0
          ? Math.ceil(Number(daysRaw))
          : 7;

    const startedAt = new Date();
    const deadline = new Date(
      startedAt.getTime() + durationDays * 24 * 60 * 60 * 1000,
    );

    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
        if (order.status === 'pending') {
          await tx.order.update({
            where: { id: orderId },
            data: { status: 'confirmed' },
          });
          await tx.orderStatusHistory.create({
            data: {
              orderId,
              status: 'confirmed',
              changedBy: user.sub,
              note: 'Auto-confirmed on Start Work',
            },
          });
        }

        const claimed = await tx.order.updateMany({
          where: {
            id: orderId,
            productionStartedAt: null,
            readinessWorkflowStatus: 'approved',
            status: { in: ['confirmed', 'pending'] },
          },
          data: {
            productionStartedAt: startedAt,
            productionDeadline: deadline,
            productionOriginalDeadline: deadline,
            productionStartedById: user.sub,
            productionDurationDays: durationDays,
            qualityReviewStatus: 'in_production',
            status: 'in_progress',
          },
        });
        if (claimed.count !== 1) {
          const fresh = await tx.order.findUnique({ where: { id: orderId } });
          if (fresh?.productionStartedAt) {
            return {
              alreadyStarted: true as const,
              productionStartedAt: fresh.productionStartedAt,
              productionDeadline: fresh.productionDeadline,
              status: fresh.status,
            };
          }
          throw new ConflictException({
            message: 'Could not authorise Start Work',
            code: 'CONFLICT',
          });
        }

        await tx.orderStatusHistory.create({
          data: {
            orderId,
            status: 'in_progress',
            changedBy: user.sub,
            note: 'Start Work authorised',
          },
        });

        if (order.artisanPayout) {
          await tx.orderArtisanPayoutEvent.create({
            data: {
              payoutId: order.artisanPayout.id,
              orderId,
              actorId: user.sub,
              action: 'start_work',
              detail: {
                productionStartedAt: startedAt.toISOString(),
                productionDeadline: deadline.toISOString(),
                productionDurationDays: durationDays,
              },
            },
          });
        }

        await tx.orderReadinessEvent.create({
          data: {
            orderId,
            actorId: user.sub,
            action: 'start_work',
            detail: {
              productionStartedAt: startedAt.toISOString(),
              productionDeadline: deadline.toISOString(),
            },
          },
        });

        return {
          alreadyStarted: false as const,
          productionStartedAt: startedAt,
          productionDeadline: deadline,
          status: 'in_progress',
        };
        },
        { maxWait: 10_000, timeout: 20_000 },
      );

      if (!result.alreadyStarted) {
        await this.notifications.notifyProductionStarted(
          order.providerId!,
          orderId,
          order.productName ?? `Order #${orderId}`,
          deadline,
        );
        if (order.customerId) {
          await this.notifications.notifyOrderStatusChange(
            order.customerId,
            orderId,
            'in_progress',
          );
        }
      }

      return {
        orderId,
        alreadyStarted: result.alreadyStarted,
        productionStartedAt: result.productionStartedAt.toISOString(),
        productionDeadline: result.productionDeadline?.toISOString() ?? null,
        status: result.status,
      };
    } catch (err) {
      if (err instanceof ConflictException) throw err;
      throw err;
    }
  }
}
