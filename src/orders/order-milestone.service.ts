import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AdminCapabilitiesService } from '../auth/admin-capabilities.service';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import {
  cloudinaryPublicId,
  cloudinaryResourceType,
} from '../upload/multer.config';

const EPSILON = 0.009;

/**
 * Extends OrderArtisanPayout with milestones — does not replace initial funding gates.
 */
@Injectable()
export class OrderMilestoneService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly capabilities: AdminCapabilitiesService,
  ) {}

  private verifiedPaid(
    transfers: Array<{ amount: number; currency: string; status: string }>,
    currency: string,
  ) {
    return transfers
      .filter(
        (t) =>
          t.status === 'verified' &&
          t.currency.toUpperCase() === currency.toUpperCase(),
      )
      .reduce((s, t) => s + t.amount, 0);
  }

  async listMilestones(orderId: number) {
    const payout = await this.prisma.orderArtisanPayout.findUnique({
      where: { orderId },
      include: {
        milestones: {
          include: { transfers: true },
          orderBy: { sequence: 'asc' },
        },
        transfers: true,
      },
    });
    if (!payout) {
      return {
        orderId,
        payout: null,
        milestones: [],
        totals: { approved: 0, paid: 0, remaining: 0 },
      };
    }

    const milestones = payout.milestones.map((m) => {
      const paid = this.verifiedPaid(m.transfers, m.currency);
      return {
        id: m.id,
        kind: m.kind,
        name: m.name,
        description: m.description,
        sequence: m.sequence,
        approvedAmount: m.approvedAmount,
        currency: m.currency,
        status: m.status,
        dueConditions: m.dueConditions,
        amountPaid: paid,
        remainingBalance: Math.max(0, m.approvedAmount - paid),
        exceptionApproved: m.exceptionApproved,
        exceptionReason: m.exceptionReason,
        eligibleAt: m.eligibleAt?.toISOString() ?? null,
        transfers: m.transfers.map((t) => ({
          id: t.id,
          amount: t.amount,
          status: t.status,
          externalReference: t.externalReference,
          recordedById: t.recordedById,
          verifiedById: t.verifiedById,
        })),
      };
    });

    const approved =
      payout.totalPayableAmount ??
      milestones.reduce((s, m) => s + m.approvedAmount, 0);
    const paid = milestones.reduce((s, m) => s + m.amountPaid, 0);

    return {
      orderId,
      payout: {
        id: payout.id,
        status: payout.status,
        currency: payout.currency,
        initialApprovedAmount: payout.approvedAmount,
        totalPayableAmount: payout.totalPayableAmount,
        disputeFlag: payout.disputeFlag,
      },
      milestones,
      totals: {
        approved,
        paid,
        remaining: Math.max(0, approved - paid),
      },
    };
  }

  async setTotalPayable(
    admin: AccessTokenPayload,
    orderId: number,
    body: {
      totalPayableAmount: number;
      reason?: string;
      exceptionApproved?: boolean;
      exceptionReason?: string;
    },
  ) {
    await this.capabilities.assertCapability(
      admin.sub,
      'payout_amount_approve',
    );
    if (
      typeof body.totalPayableAmount !== 'number' ||
      body.totalPayableAmount < 0
    ) {
      throw new BadRequestException({
        message: 'totalPayableAmount must be non-negative',
        code: 'VALIDATION_ERROR',
      });
    }
    const payout = await this.prisma.orderArtisanPayout.findUnique({
      where: { orderId },
      include: { milestones: true },
    });
    if (!payout) {
      throw new NotFoundException({
        message: 'Artisan payout record missing',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    const milestoneSum = payout.milestones.reduce(
      (s, m) => s + m.approvedAmount,
      0,
    );
    if (
      milestoneSum > body.totalPayableAmount + EPSILON &&
      !body.exceptionApproved
    ) {
      throw new BadRequestException({
        message:
          'Milestone totals exceed total payable; exceptionApproved + exceptionReason required',
        code: 'MILESTONE_TOTAL_EXCEEDED',
      });
    }
    if (
      milestoneSum > body.totalPayableAmount + EPSILON &&
      !body.exceptionReason?.trim()
    ) {
      throw new BadRequestException({
        message: 'exceptionReason required when exceeding total payable',
        code: 'VALIDATION_ERROR',
      });
    }

    return this.prisma.orderArtisanPayout.update({
      where: { id: payout.id },
      data: {
        totalPayableAmount: body.totalPayableAmount,
        totalPayableApprovedById: admin.sub,
        totalPayableApprovedAt: new Date(),
        totalPayableReason: body.reason?.trim() || null,
        totalPayableExceptionApproved: !!body.exceptionApproved,
        events: {
          create: {
            orderId,
            actorId: admin.sub,
            action: 'total_payable_approved',
            detail: {
              totalPayableAmount: body.totalPayableAmount,
              milestoneSum,
              exceptionApproved: !!body.exceptionApproved,
            },
          },
        },
      },
    });
  }

  async createMilestone(
    admin: AccessTokenPayload,
    orderId: number,
    body: {
      kind: 'initial' | 'intermediate' | 'final';
      name: string;
      description?: string;
      approvedAmount: number;
      currency?: string;
      sequence?: number;
      dueConditions?: Record<string, unknown>;
      exceptionApproved?: boolean;
      exceptionReason?: string;
    },
  ) {
    await this.capabilities.assertCapability(
      admin.sub,
      'payout_amount_approve',
    );
    if (!body.name?.trim()) {
      throw new BadRequestException({
        message: 'name is required',
        code: 'VALIDATION_ERROR',
      });
    }
    if (typeof body.approvedAmount !== 'number' || body.approvedAmount < 0) {
      throw new BadRequestException({
        message: 'approvedAmount must be non-negative',
        code: 'VALIDATION_ERROR',
      });
    }

    const payout = await this.prisma.orderArtisanPayout.findUnique({
      where: { orderId },
      include: { milestones: true },
    });
    if (!payout) {
      throw new NotFoundException({
        message:
          'Artisan payout record missing — approve readiness/initial first',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    const nextSum =
      payout.milestones.reduce((s, m) => s + m.approvedAmount, 0) +
      body.approvedAmount;
    if (
      payout.totalPayableAmount != null &&
      nextSum > payout.totalPayableAmount + EPSILON
    ) {
      if (!body.exceptionApproved || !body.exceptionReason?.trim()) {
        throw new BadRequestException({
          message:
            'Milestone would exceed totalPayableAmount; exceptionApproved + exceptionReason required',
          code: 'MILESTONE_TOTAL_EXCEEDED',
        });
      }
    }

    const sequence =
      body.sequence ??
      (payout.milestones.length
        ? Math.max(...payout.milestones.map((m) => m.sequence)) + 1
        : 0);

    const milestone = await this.prisma.orderArtisanPayoutMilestone.create({
      data: {
        payoutId: payout.id,
        kind: body.kind,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        sequence,
        approvedAmount: body.approvedAmount,
        currency: (body.currency || payout.currency || 'NGN').toUpperCase(),
        status: body.kind === 'initial' ? 'amount_approved' : 'planned',
        dueConditions: (body.dueConditions ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        amountApprovedById: admin.sub,
        amountApprovedAt: new Date(),
        exceptionApproved: !!body.exceptionApproved,
        exceptionReason: body.exceptionReason?.trim() || null,
      },
    });

    await this.prisma.orderArtisanPayoutEvent.create({
      data: {
        payoutId: payout.id,
        orderId,
        actorId: admin.sub,
        action: 'milestone_created',
        detail: {
          milestoneId: milestone.id,
          kind: body.kind,
          approvedAmount: body.approvedAmount,
        },
      },
    });

    return milestone;
  }

  async markMilestoneEligible(
    admin: AccessTokenPayload,
    orderId: number,
    milestoneId: number,
  ) {
    await this.capabilities.assertCapability(
      admin.sub,
      'payout_amount_approve',
    );
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { artisanPayout: { include: { milestones: true } } },
    });
    if (!order?.artisanPayout) {
      throw new NotFoundException({
        message: 'Payout not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    const milestone = order.artisanPayout.milestones.find(
      (m) => m.id === milestoneId,
    );
    if (!milestone) {
      throw new NotFoundException({
        message: 'Milestone not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    if (milestone.kind === 'final') {
      const openDisputes = await this.prisma.dispute.count({
        where: { orderId, status: 'open' },
      });
      if (
        order.qualityReviewStatus !== 'approved' ||
        (!order.finalPayoutReviewEligible &&
          order.fulfillmentStatus !== 'customer_accepted') ||
        openDisputes > 0 ||
        ['disputed', 'reversed'].includes(order.artisanPayout.status)
      ) {
        throw new BadRequestException({
          message:
            'Final milestone requires quality approval, delivery acceptance / eligibility, and no open payout or order dispute',
          code: 'FINAL_MILESTONE_NOT_ELIGIBLE',
        });
      }
    }

    // Eligibility alone never marks money paid.
    return this.prisma.orderArtisanPayoutMilestone.update({
      where: { id: milestoneId },
      data: {
        status: 'eligible',
        eligibleAt: new Date(),
      },
    });
  }

  async recordMilestoneTransfer(
    admin: AccessTokenPayload,
    orderId: number,
    milestoneId: number,
    body: {
      amount: number;
      currency?: string;
      transferDate: string;
      payeeName: string;
      payeeDetails?: string;
      externalReference: string;
    },
    files: Express.Multer.File[] = [],
  ) {
    await this.capabilities.assertCapability(
      admin.sub,
      'payout_transfer_record',
    );
    const payout = await this.prisma.orderArtisanPayout.findUnique({
      where: { orderId },
      include: {
        milestones: { include: { transfers: true } },
      },
    });
    if (!payout) {
      throw new NotFoundException({
        message: 'Payout not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    const milestone = payout.milestones.find((m) => m.id === milestoneId);
    if (!milestone) {
      throw new NotFoundException({
        message: 'Milestone not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    if (['disputed', 'reversed'].includes(payout.status)) {
      throw new BadRequestException({
        message:
          'Transfers are blocked while the artisan payout is disputed or reversed',
        code: 'PAYOUT_RELEASE_BLOCKED',
      });
    }
    if (milestone.kind === 'final') {
      const openDisputes = await this.prisma.dispute.count({
        where: { orderId, status: 'open' },
      });
      if (openDisputes > 0) {
        throw new BadRequestException({
          message:
            'Final transfer is blocked while an order dispute remains open',
          code: 'PAYOUT_RELEASE_BLOCKED',
        });
      }
    }
    if (
      !['eligible', 'amount_approved', 'recorded', 'verified'].includes(
        milestone.status,
      )
    ) {
      throw new BadRequestException({
        message: `Milestone status "${milestone.status}" cannot receive transfers`,
        code: 'VALIDATION_ERROR',
      });
    }
    if (
      typeof body.amount !== 'number' ||
      body.amount <= 0 ||
      !body.externalReference?.trim() ||
      !body.payeeName?.trim()
    ) {
      throw new BadRequestException({
        message: 'amount, payeeName and externalReference are required',
        code: 'VALIDATION_ERROR',
      });
    }
    if (
      payout.isSimulated &&
      !body.externalReference.trim().startsWith('SIM-')
    ) {
      throw new BadRequestException({
        message: 'Simulated payouts require a SIM- reference',
        code: 'VALIDATION_ERROR',
      });
    }

    const currency = (body.currency || milestone.currency).toUpperCase();
    try {
      const transfer = await this.prisma.orderArtisanPayoutTransfer.create({
        data: {
          payoutId: payout.id,
          milestoneId,
          amount: body.amount,
          currency,
          transferDate: new Date(body.transferDate),
          payeeName: body.payeeName.trim(),
          payeeDetails: body.payeeDetails?.trim() || null,
          externalReference: body.externalReference.trim(),
          isSimulated: payout.isSimulated,
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
      });
      await this.prisma.orderArtisanPayoutMilestone.update({
        where: { id: milestoneId },
        data: {
          status: milestone.status === 'verified' ? 'verified' : 'recorded',
        },
      });
      await this.prisma.orderArtisanPayoutEvent.create({
        data: {
          payoutId: payout.id,
          orderId,
          actorId: admin.sub,
          action: 'milestone_transfer_recorded',
          detail: {
            milestoneId,
            transferId: transfer.id,
            unlocksAsPaid: false,
          },
        },
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

  async verifyMilestoneTransfer(
    admin: AccessTokenPayload,
    orderId: number,
    transferId: number,
    body: { notes: string },
  ) {
    await this.capabilities.assertCapability(
      admin.sub,
      'payout_transfer_verify',
    );
    if (!body.notes?.trim()) {
      throw new BadRequestException({
        message: 'verification notes required',
        code: 'VALIDATION_ERROR',
      });
    }
    const transfer = await this.prisma.orderArtisanPayoutTransfer.findFirst({
      where: { id: transferId, payout: { orderId } },
      include: {
        evidence: true,
        milestone: { include: { transfers: true } },
        payout: true,
      },
    });
    if (!transfer?.milestone) {
      throw new NotFoundException({
        message: 'Milestone transfer not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    if (['disputed', 'reversed'].includes(transfer.payout.status)) {
      throw new BadRequestException({
        message:
          'Transfer verification is blocked while the artisan payout is disputed or reversed',
        code: 'PAYOUT_RELEASE_BLOCKED',
      });
    }
    if (transfer.milestone.kind === 'final') {
      const openDisputes = await this.prisma.dispute.count({
        where: { orderId, status: 'open' },
      });
      if (openDisputes > 0) {
        throw new BadRequestException({
          message:
            'Final transfer verification is blocked while an order dispute remains open',
          code: 'PAYOUT_RELEASE_BLOCKED',
        });
      }
    }
    if (transfer.recordedById === admin.sub) {
      throw new BadRequestException({
        message: 'Recorder cannot verify their own transfer',
        code: 'RECORDER_CANNOT_VERIFY',
      });
    }
    if (transfer.status !== 'recorded') {
      throw new ConflictException({
        message: 'Transfer already processed',
        code: 'DUPLICATE_VERIFICATION',
      });
    }
    if (transfer.evidence.length < 1) {
      throw new BadRequestException({
        message: 'Supporting evidence required',
        code: 'EVIDENCE_REQUIRED',
      });
    }

    await this.prisma.orderArtisanPayoutTransfer.update({
      where: { id: transfer.id },
      data: {
        status: 'verified',
        verifiedById: admin.sub,
        verifiedAt: new Date(),
        verificationNotes: body.notes.trim(),
      },
    });

    const all = await this.prisma.orderArtisanPayoutTransfer.findMany({
      where: { milestoneId: transfer.milestoneId! },
    });
    const paid = this.verifiedPaid(all, transfer.milestone.currency);
    const funded = paid + EPSILON >= transfer.milestone.approvedAmount;
    await this.prisma.orderArtisanPayoutMilestone.update({
      where: { id: transfer.milestoneId! },
      data: { status: funded ? 'verified' : 'recorded' },
    });
    await this.prisma.orderArtisanPayoutEvent.create({
      data: {
        payoutId: transfer.payoutId,
        orderId,
        actorId: admin.sub,
        action: 'milestone_transfer_verified',
        detail: {
          transferId,
          milestoneId: transfer.milestoneId,
          paid,
          funded,
        },
      },
    });

    return { transferId, funded, amountPaid: paid };
  }

  /** Ensure initial funding appears as a milestone after amount approval (idempotent). */
  async ensureInitialMilestone(orderId: number, actorId: number) {
    const payout = await this.prisma.orderArtisanPayout.findUnique({
      where: { orderId },
      include: { milestones: true },
    });
    if (!payout || payout.approvedAmount == null) return null;
    const existing = payout.milestones.find((m) => m.kind === 'initial');
    if (existing) return existing;
    return this.prisma.orderArtisanPayoutMilestone.create({
      data: {
        payoutId: payout.id,
        kind: 'initial',
        name: 'Initial material funding',
        description: 'Phase 2 initial artisan payout',
        sequence: 0,
        approvedAmount: payout.approvedAmount,
        currency: payout.currency,
        status:
          payout.status === 'verified'
            ? 'verified'
            : payout.status === 'not_required'
              ? 'verified'
              : 'amount_approved',
        amountApprovedById: payout.amountApprovedById,
        amountApprovedAt: payout.amountApprovedAt,
        eligibleAt: new Date(),
      },
    });
  }
}
