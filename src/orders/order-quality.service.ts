import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import {
  cloudinaryPublicId,
  cloudinaryResourceType,
  messageAttachmentKind,
} from '../upload/multer.config';
import { signedAuthenticatedUrl } from '../upload/cloudinary';

const FULFILLMENT = [
  'ready_for_delivery',
  'dispatched',
  'delivered',
  'customer_accepted',
  'delivery_disputed',
] as const;

@Injectable()
export class OrderQualityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  /** Hours after delivery before auto eligibility/escalation. Unset = policy missing. */
  customerReviewHours(): number | null {
    const raw = this.config.get<string>('CUSTOMER_DELIVERY_REVIEW_HOURS');
    if (raw == null || raw.trim() === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  private async ownedArtisanOrder(user: AccessTokenPayload, orderId: number) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException({ message: 'Order not found', code: 'RESOURCE_NOT_FOUND' });
    }
    if (user.role === 'admin') return order;
    if (user.role === 'artisan' && order.providerId === user.sub) return order;
    if (user.role === 'customer' && order.customerId === user.sub) return order;
    throw new ForbiddenException({ message: 'Forbidden', code: 'FORBIDDEN' });
  }

  async getBundle(user: AccessTokenPayload, orderId: number) {
    const order = await this.ownedArtisanOrder(user, orderId);
    const [submissions, readiness, deliveryEvents] = await Promise.all([
      this.prisma.orderQualitySubmission.findMany({
        where: { orderId },
        include: {
          evidence: { orderBy: { id: 'asc' } },
          reviews: { orderBy: { createdAt: 'asc' } },
        },
        orderBy: { version: 'asc' },
      }),
      this.prisma.orderReadinessAssessment.findMany({
        where: { orderId },
        include: { evidence: true, reviews: true },
        orderBy: { version: 'asc' },
      }),
      this.prisma.orderDeliveryEvent.findMany({
        where: { orderId },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return {
      orderId,
      productName: order.productName,
      customisationData: order.customisationData,
      status: order.status,
      qualityReviewStatus: order.qualityReviewStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      qualitySubmittedAt: order.qualitySubmittedAt?.toISOString() ?? null,
      qualityApprovedAt: order.qualityApprovedAt?.toISOString() ?? null,
      dispatchedAt: order.dispatchedAt?.toISOString() ?? null,
      deliveredAt: order.deliveredAt?.toISOString() ?? null,
      customerAcceptedAt: order.customerAcceptedAt?.toISOString() ?? null,
      customerReviewDeadline: order.customerReviewDeadline?.toISOString() ?? null,
      customerRating: order.customerRating,
      customerReview: order.customerReview,
      finalPayoutReviewEligible: order.finalPayoutReviewEligible,
      finalPayoutEscalatedAt: order.finalPayoutEscalatedAt?.toISOString() ?? null,
      customerReviewPolicyHours: this.customerReviewHours(),
      readinessAssessments: readiness.map((a) => ({
        id: a.id,
        version: a.version,
        type: a.type,
        status: a.status,
        payload: a.payload,
        submittedAt: a.submittedAt?.toISOString() ?? null,
      })),
      submissions: submissions.map((s) => ({
        id: s.id,
        version: s.version,
        status: s.status,
        description: s.description,
        specsConfirmed: s.specsConfirmed,
        outstandingIssues: s.outstandingIssues,
        submittedAt: s.submittedAt.toISOString(),
        evidence: s.evidence.map((e) => ({
          id: e.id,
          name: e.attachmentName,
          kind: e.attachmentKind,
          mimeType: e.attachmentMimeType,
          url: `/orders/${orderId}/quality/submissions/${s.id}/evidence/${e.id}`,
        })),
        reviews: s.reviews.map((r) => ({
          id: r.id,
          reviewerId: r.reviewerId,
          decision: r.decision,
          reason: r.reason,
          createdAt: r.createdAt.toISOString(),
        })),
      })),
      deliveryEvents: deliveryEvents.map((ev) => ({
        id: ev.id,
        action: ev.action,
        actorId: ev.actorId,
        detail: ev.detail,
        createdAt: ev.createdAt.toISOString(),
      })),
    };
  }

  async submitForReview(
    user: AccessTokenPayload,
    orderId: number,
    body: {
      description?: string;
      specsConfirmed?: boolean | string;
      outstandingIssues?: string;
    },
    files: Express.Multer.File[] = [],
  ) {
    if (user.role !== 'artisan') {
      throw new ForbiddenException({ message: 'Forbidden', code: 'FORBIDDEN' });
    }
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.providerId !== user.sub) {
      throw new ForbiddenException({ message: 'Forbidden', code: 'FORBIDDEN' });
    }
    if (!order.productionStartedAt || order.status !== 'in_progress') {
      throw new BadRequestException({
        message: 'Order must be in active production',
        code: 'VALIDATION_ERROR',
      });
    }
    if (!body.description?.trim()) {
      throw new BadRequestException({
        message: 'Description of completed work is required',
        code: 'VALIDATION_ERROR',
      });
    }
    const specsConfirmed =
      body.specsConfirmed === true || body.specsConfirmed === 'true';
    if (!specsConfirmed) {
      throw new BadRequestException({
        message: 'Confirmation against original specifications is required',
        code: 'VALIDATION_ERROR',
      });
    }
    const photos = (files ?? []).filter((f) =>
      (f.mimetype || '').startsWith('image/'),
    );
    if (photos.length < 1) {
      throw new BadRequestException({
        message: 'At least one final product photo is required',
        code: 'VALIDATION_ERROR',
      });
    }
    if (['submitted', 'approved'].includes(order.qualityReviewStatus ?? '')) {
      throw new BadRequestException({
        message: `Cannot submit while quality status is "${order.qualityReviewStatus}"`,
        code: 'CONFLICT',
      });
    }

    const last = await this.prisma.orderQualitySubmission.findFirst({
      where: { orderId },
      orderBy: { version: 'desc' },
    });
    const version = (last?.version ?? 0) + 1;
    if (last && last.status === 'submitted') {
      await this.prisma.orderQualitySubmission.update({
        where: { id: last.id },
        data: { status: 'superseded' },
      });
    }

    const submission = await this.prisma.orderQualitySubmission.create({
      data: {
        orderId,
        version,
        artisanId: user.sub,
        status: 'submitted',
        description: body.description.trim(),
        specsConfirmed: true,
        outstandingIssues: body.outstandingIssues?.trim() || null,
        evidence: {
          create: files.map((file) => ({
            attachmentPublicId: cloudinaryPublicId(file),
            attachmentResourceType: cloudinaryResourceType(file, file.mimetype),
            attachmentName: file.originalname || 'evidence',
            attachmentMimeType: file.mimetype || 'application/octet-stream',
            attachmentBytes: file.size ?? null,
            attachmentKind: messageAttachmentKind(file.mimetype),
          })),
        },
      },
      include: { evidence: true },
    });

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        qualityReviewStatus: 'submitted',
        qualitySubmittedAt: new Date(),
      },
    });

    const admins = await this.prisma.user.findMany({
      where: { roles: { some: { role: { name: 'admin' } } } },
      select: { id: true },
      take: 20,
    });
    await Promise.all(
      admins.map((a) =>
        this.notifications.notifyQualitySubmitted(
          a.id,
          orderId,
          order.productName ?? `Order #${orderId}`,
        ),
      ),
    );

    return submission;
  }

  async adminDecide(
    admin: AccessTokenPayload,
    orderId: number,
    submissionId: number,
    body: {
      decision: 'approve' | 'request_rework' | 'reject' | 'escalate_dispute';
      reason?: string;
    },
  ) {
    if (admin.role !== 'admin') {
      throw new ForbiddenException({ message: 'Forbidden', code: 'FORBIDDEN' });
    }
    if (
      (body.decision === 'request_rework' ||
        body.decision === 'reject' ||
        body.decision === 'escalate_dispute') &&
      !body.reason?.trim()
    ) {
      throw new BadRequestException({
        message: 'A reason is required',
        code: 'VALIDATION_ERROR',
      });
    }

    const submission = await this.prisma.orderQualitySubmission.findFirst({
      where: { id: submissionId, orderId, status: 'submitted' },
    });
    if (!submission) {
      throw new NotFoundException({
        message: 'Submitted quality review not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });

    const nextSubmissionStatus =
      body.decision === 'approve'
        ? 'approved'
        : body.decision === 'request_rework'
          ? 'changes_requested'
          : body.decision === 'reject'
            ? 'rejected'
            : 'submitted';

    await this.prisma.$transaction(async (tx) => {
      await tx.orderQualitySubmission.update({
        where: { id: submissionId },
        data: { status: nextSubmissionStatus },
      });
      await tx.orderQualityReview.create({
        data: {
          submissionId,
          reviewerId: admin.sub,
          decision: body.decision,
          reason: body.reason?.trim() || null,
        },
      });

      if (body.decision === 'approve') {
        // Quality approval does NOT mark money paid or delivered.
        await tx.order.update({
          where: { id: orderId },
          data: {
            qualityReviewStatus: 'approved',
            qualityApprovedAt: new Date(),
            qualityApprovedById: admin.sub,
            fulfillmentStatus: 'ready_for_delivery',
            status: 'ready',
          },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId,
            status: 'ready',
            changedBy: admin.sub,
            note: 'Quality approved — ready for delivery (no payout auto-released)',
          },
        });
        await tx.orderDeliveryEvent.create({
          data: {
            orderId,
            actorId: admin.sub,
            action: 'ready_for_delivery',
            detail: { submissionId, payoutAutoReleased: false },
          },
        });
      } else if (body.decision === 'request_rework') {
        await tx.order.update({
          where: { id: orderId },
          data: {
            qualityReviewStatus: 'changes_requested',
            status: 'in_progress',
          },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId,
            status: 'in_progress',
            changedBy: admin.sub,
            note: `Rework requested: ${body.reason?.trim()}`,
          },
        });
      } else if (body.decision === 'reject') {
        await tx.order.update({
          where: { id: orderId },
          data: { qualityReviewStatus: 'rejected' },
        });
      } else {
        await tx.order.update({
          where: { id: orderId },
          data: { qualityReviewStatus: 'submitted' },
        });
        await tx.dispute.create({
          data: {
            orderId,
            customerId: order.customerId,
            issueType: 'quality_escalation',
            description: body.reason!.trim(),
            status: 'open',
          },
        });
      }
    });

    if (order.providerId) {
      await this.notifications.notifyQualityDecision(
        order.providerId,
        orderId,
        order.productName ?? `Order #${orderId}`,
        body.decision,
        body.reason?.trim() || 'Approved for delivery',
      );
    }

    return { orderId, submissionId, decision: body.decision };
  }

  async updateFulfillment(
    user: AccessTokenPayload,
    orderId: number,
    body: { status: string; note?: string },
  ) {
    const order = await this.ownedArtisanOrder(user, orderId);
    if (order.qualityReviewStatus !== 'approved') {
      throw new BadRequestException({
        message: 'Quality approval is required before fulfillment updates',
        code: 'QUALITY_REQUIRED',
      });
    }
    const status = body.status?.trim();
    if (!FULFILLMENT.includes(status as (typeof FULFILLMENT)[number])) {
      throw new BadRequestException({
        message: `Invalid fulfillment status. Allowed: ${FULFILLMENT.join(', ')}`,
        code: 'VALIDATION_ERROR',
      });
    }
    if (user.role === 'customer') {
      throw new ForbiddenException({
        message: 'Customers use confirm/dispute endpoints',
        code: 'FORBIDDEN',
      });
    }
    if (user.role === 'artisan' && !['dispatched', 'delivered'].includes(status)) {
      throw new ForbiddenException({
        message: 'Artisans may only mark dispatched or delivered',
        code: 'FORBIDDEN',
      });
    }

    const data: Record<string, unknown> = { fulfillmentStatus: status };
    if (status === 'dispatched') {
      data.dispatchedAt = new Date();
      data.status = 'shipped';
    }
    if (status === 'delivered') {
      data.deliveredAt = new Date();
      data.status = 'delivered';
      const hours = this.customerReviewHours();
      if (hours != null) {
        data.customerReviewDeadline = new Date(
          Date.now() + hours * 60 * 60 * 1000,
        );
      }
    }

    await this.prisma.order.update({ where: { id: orderId }, data });
    if (typeof data.status === 'string') {
      await this.prisma.orderStatusHistory.create({
        data: {
          orderId,
          status: data.status,
          changedBy: user.sub,
          note: body.note?.trim() || `Fulfillment: ${status}`,
        },
      });
    }
    await this.prisma.orderDeliveryEvent.create({
      data: {
        orderId,
        actorId: user.sub,
        action: status,
        detail: { note: body.note?.trim() || null },
      },
    });

    await this.notifications.notifyDeliveryStatus(
      order.customerId,
      orderId,
      order.productName ?? `Order #${orderId}`,
      status,
    );

    return { orderId, fulfillmentStatus: status };
  }

  async customerAccept(
    user: AccessTokenPayload,
    orderId: number,
    body: { rating?: number; review?: string },
  ) {
    if (user.role !== 'customer') {
      throw new ForbiddenException({ message: 'Forbidden', code: 'FORBIDDEN' });
    }
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.customerId !== user.sub) {
      throw new ForbiddenException({ message: 'Forbidden', code: 'FORBIDDEN' });
    }
    if (
      order.fulfillmentStatus !== 'delivered' &&
      order.fulfillmentStatus !== 'dispatched'
    ) {
      throw new BadRequestException({
        message: 'Order is not awaiting customer acceptance',
        code: 'VALIDATION_ERROR',
      });
    }
    const rating =
      body.rating != null ? Number(body.rating) : null;
    if (rating != null && (!Number.isFinite(rating) || rating < 1 || rating > 5)) {
      throw new BadRequestException({
        message: 'rating must be 1-5',
        code: 'VALIDATION_ERROR',
      });
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        fulfillmentStatus: 'customer_accepted',
        customerAcceptedAt: new Date(),
        customerRating: rating,
        customerReview: body.review?.trim() || null,
        finalPayoutReviewEligible: true,
      },
    });
    await this.prisma.orderDeliveryEvent.create({
      data: {
        orderId,
        actorId: user.sub,
        action: 'customer_accepted',
        detail: { rating, review: body.review?.trim() || null },
      },
    });
    return { orderId, fulfillmentStatus: 'customer_accepted' };
  }

  async customerDispute(
    user: AccessTokenPayload,
    orderId: number,
    body: { description: string; issueType?: string },
  ) {
    if (user.role !== 'customer') {
      throw new ForbiddenException({ message: 'Forbidden', code: 'FORBIDDEN' });
    }
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.customerId !== user.sub) {
      throw new ForbiddenException({ message: 'Forbidden', code: 'FORBIDDEN' });
    }
    if (!body.description?.trim()) {
      throw new BadRequestException({
        message: 'description is required',
        code: 'VALIDATION_ERROR',
      });
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        fulfillmentStatus: 'delivery_disputed',
        finalPayoutReviewEligible: false,
      },
    });
    await this.prisma.dispute.create({
      data: {
        orderId,
        customerId: user.sub,
        issueType: body.issueType?.trim() || 'delivery_problem',
        description: body.description.trim(),
        status: 'open',
      },
    });
    await this.prisma.orderDeliveryEvent.create({
      data: {
        orderId,
        actorId: user.sub,
        action: 'delivery_disputed',
        detail: { description: body.description.trim() },
      },
    });
    return { orderId, fulfillmentStatus: 'delivery_disputed' };
  }

  async processCustomerReviewWindows(now = new Date()) {
    const hours = this.customerReviewHours();
    if (hours == null) {
      return {
        scanned: 0,
        eligible: 0,
        escalated: 0,
        policyConfigured: false,
        message:
          'CUSTOMER_DELIVERY_REVIEW_HOURS is not configured — auto eligibility/escalation disabled',
      };
    }

    const due = await this.prisma.order.findMany({
      where: {
        fulfillmentStatus: 'delivered',
        customerAcceptedAt: null,
        customerReviewDeadline: { lte: now },
        finalPayoutReviewEligible: false,
        finalPayoutEscalatedAt: null,
      },
      include: {
        disputes: { where: { status: 'open' } },
        deliveryEvents: true,
      },
    });

    let eligible = 0;
    let escalated = 0;
    for (const order of due) {
      const hasOpenDispute = order.disputes.length > 0;
      const deliveryEvidenced = order.deliveryEvents.some((e) =>
        ['delivered', 'dispatched'].includes(e.action),
      );
      if (!hasOpenDispute && deliveryEvidenced) {
        await this.prisma.order.update({
          where: { id: order.id },
          data: { finalPayoutReviewEligible: true },
        });
        await this.prisma.orderDeliveryEvent.create({
          data: {
            orderId: order.id,
            action: 'final_payout_eligible',
            detail: { reason: 'review_window_elapsed_no_dispute' },
          },
        });
        eligible += 1;
      } else {
        await this.prisma.order.update({
          where: { id: order.id },
          data: { finalPayoutEscalatedAt: now },
        });
        await this.prisma.orderDeliveryEvent.create({
          data: {
            orderId: order.id,
            action: 'escalated',
            detail: {
              reason: hasOpenDispute
                ? 'open_dispute'
                : 'missing_delivery_evidence',
            },
          },
        });
        escalated += 1;
      }
    }

    return {
      scanned: due.length,
      eligible,
      escalated,
      policyConfigured: true,
    };
  }

  async getEvidenceAccess(
    user: AccessTokenPayload,
    orderId: number,
    submissionId: number,
    evidenceId: number,
  ) {
    await this.ownedArtisanOrder(user, orderId);
    const evidence = await this.prisma.orderQualityEvidence.findFirst({
      where: {
        id: evidenceId,
        submissionId,
        submission: { orderId },
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
}
