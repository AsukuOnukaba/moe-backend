import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  isCloudinaryConfigured,
  signedAuthenticatedUrl,
} from '../upload/cloudinary';
import {
  cloudinaryPublicId,
  cloudinaryResourceType,
  messageAttachmentKind,
} from '../upload/multer.config';
import {
  DEFAULT_HIGH_VALUE_THRESHOLD_NGN,
  NEW_ORDERS_READINESS_STATUSES,
  READINESS_REMINDER_12H_HOURS,
  READINESS_REMINDER_20H_HOURS,
  READINESS_RESPONSE_HOURS,
  type AdminReadinessFilter,
  type ReadinessWorkflowStatus,
} from './readiness.constants';
import type {
  AdminExtendDeadlineBody,
  AdminReadinessDecisionBody,
  DetailedReadinessPayload,
  StandardReadinessPayload,
  SubmitReadinessBody,
} from './dto/submit-readiness.dto';
import { ArtisanPayoutService } from './artisan-payout.service';

@Injectable()
export class OrderReadinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    private readonly artisanPayouts: ArtisanPayoutService,
  ) {}

  highValueThresholdNgn(): number {
    const raw = this.config.get<string>('ORDER_HIGH_VALUE_THRESHOLD_NGN');
    const n = raw != null && raw !== '' ? Number(raw) : DEFAULT_HIGH_VALUE_THRESHOLD_NGN;
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_HIGH_VALUE_THRESHOLD_NGN;
  }

  resolveAssessmentType(order: {
    isCustomOrder: boolean;
    highValueOverride?: boolean | null;
    price?: number | null;
    currency?: string | null;
  }): 'standard' | 'detailed' {
    if (order.highValueOverride === true) return 'detailed';
    if (order.isCustomOrder) return 'detailed';
    const price = Number(order.price ?? 0);
    const currency = (order.currency || 'NGN').toUpperCase();
    if (currency === 'NGN' && price >= this.highValueThresholdNgn()) {
      return 'detailed';
    }
    return 'standard';
  }

  async assignReadinessOnCreate(order: {
    id: number;
    providerId: number | null;
    productName: string | null;
  }, now = new Date()) {
    if (!order.providerId) return null;
    const deadline = new Date(
      now.getTime() + READINESS_RESPONSE_HOURS * 60 * 60 * 1000,
    );
    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        readinessAssignedAt: now,
        readinessResponseDeadline: deadline,
        readinessWorkflowStatus: 'awaiting_response',
      },
    });
    await this.appendEvent(order.id, null, 'assigned', {
      deadline: deadline.toISOString(),
    });
    await this.notifications.notifyReadinessAssigned(
      order.providerId,
      order.id,
      order.productName ?? `Order #${order.id}`,
      deadline,
    );
    return updated;
  }

  private async appendEvent(
    orderId: number,
    actorId: number | null,
    action: string,
    detail?: Record<string, unknown>,
  ) {
    await this.prisma.orderReadinessEvent.create({
      data: {
        orderId,
        actorId,
        action,
        detail: detail ? (detail as object) : undefined,
      },
    });
  }

  private evidenceDto(
    orderId: number,
    assessmentId: number,
    row: {
      id: number;
      attachmentName: string;
      attachmentMimeType: string;
      attachmentBytes: number | null;
      attachmentKind: string;
      durationMs: number | null;
    },
  ) {
    return {
      id: row.id,
      name: row.attachmentName,
      mimeType: row.attachmentMimeType,
      bytes: row.attachmentBytes,
      kind: row.attachmentKind,
      durationMs: row.durationMs,
      url: `/orders/${orderId}/readiness/assessments/${assessmentId}/evidence/${row.id}`,
    };
  }

  private assessmentDto(
    orderId: number,
    row: {
      id: number;
      version: number;
      type: string;
      status: string;
      artisanId: number;
      payload: unknown;
      cannotFulfil: boolean;
      cannotFulfilReason: string | null;
      acknowledgedRequirements: boolean;
      reviewedRequirementsAt: Date | null;
      submittedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      evidence?: Array<{
        id: number;
        attachmentName: string;
        attachmentMimeType: string;
        attachmentBytes: number | null;
        attachmentKind: string;
        durationMs: number | null;
      }>;
      reviews?: Array<{
        id: number;
        reviewerId: number;
        decision: string;
        reason: string | null;
        createdAt: Date;
      }>;
    },
  ) {
    return {
      id: row.id,
      orderId,
      version: row.version,
      type: row.type,
      status: row.status,
      artisanId: row.artisanId,
      payload: row.payload,
      cannotFulfil: row.cannotFulfil,
      cannotFulfilReason: row.cannotFulfilReason,
      acknowledgedRequirements: row.acknowledgedRequirements,
      reviewedRequirementsAt: row.reviewedRequirementsAt?.toISOString() ?? null,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      evidence: (row.evidence ?? []).map((e) =>
        this.evidenceDto(orderId, row.id, e),
      ),
      reviews: (row.reviews ?? []).map((r) => ({
        id: r.id,
        reviewerId: r.reviewerId,
        decision: r.decision,
        reason: r.reason,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  readinessSummary(order: {
    readinessWorkflowStatus: string | null;
    readinessAssignedAt: Date | null;
    readinessResponseDeadline: Date | null;
    readinessDeadlineExtendedAt: Date | null;
    readinessExtensionHours: number | null;
    readinessExtensionReason: string | null;
    highValueOverride: boolean | null;
    isCustomOrder: boolean;
    price: number | null;
    currency: string;
  }) {
    if (!order.readinessWorkflowStatus) return null;
    const type = this.resolveAssessmentType(order);
    const deadline = order.readinessResponseDeadline;
    const msLeft = deadline ? deadline.getTime() - Date.now() : null;
    return {
      workflowStatus: order.readinessWorkflowStatus as ReadinessWorkflowStatus,
      assessmentType: type,
      assignedAt: order.readinessAssignedAt?.toISOString() ?? null,
      responseDeadline: deadline?.toISOString() ?? null,
      msRemaining: msLeft,
      extendedAt: order.readinessDeadlineExtendedAt?.toISOString() ?? null,
      extensionHours: order.readinessExtensionHours,
      extensionReason: order.readinessExtensionReason,
      highValueThresholdNgn: this.highValueThresholdNgn(),
    };
  }

  private async getOwnedOrder(user: AccessTokenPayload, orderId: number) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException({
        message: 'Order not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    if (user.role === 'admin') return order;
    if (user.role === 'artisan' && order.providerId === user.sub) return order;
    throw new ForbiddenException({
      message: 'Forbidden',
      code: 'FORBIDDEN',
    });
  }

  async getReadinessBundle(user: AccessTokenPayload, orderId: number) {
    const order = await this.getOwnedOrder(user, orderId);
    const assessments = await this.prisma.orderReadinessAssessment.findMany({
      where: { orderId },
      include: {
        evidence: { orderBy: { id: 'asc' } },
        reviews: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { version: 'asc' },
    });
    const events = await this.prisma.orderReadinessEvent.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
    return {
      orderId: order.id,
      readiness: this.readinessSummary(order),
      customerRequirements: {
        productName: order.productName,
        productImage: order.productImage,
        quantity: 1,
        price: order.price,
        currency: order.currency,
        isCustomOrder: order.isCustomOrder,
        customisationData: order.customisationData,
        estimatedDelivery: order.estimatedDelivery,
        rushOrder: order.rushOrder,
        shipping: {
          city: order.shippingCity,
          state: order.shippingState,
          country: order.shippingCountry,
        },
      },
      assessments: assessments.map((a) => this.assessmentDto(order.id, a)),
      events: events.map((e) => ({
        id: e.id,
        action: e.action,
        actorId: e.actorId,
        detail: e.detail,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }

  private validateStandard(payload: StandardReadinessPayload) {
    const requiredBool = [
      'productAvailable',
      'exactSpecMatch',
      'quantityConfirmed',
      'canFulfil',
    ] as const;
    for (const key of requiredBool) {
      if (typeof payload[key] !== 'boolean') {
        throw new BadRequestException({
          message: `Missing or invalid field: ${key}`,
          code: 'VALIDATION_ERROR',
        });
      }
    }
    if (
      typeof payload.estimatedDispatchDate !== 'string' ||
      !payload.estimatedDispatchDate.trim()
    ) {
      throw new BadRequestException({
        message: 'estimatedDispatchDate is required',
        code: 'VALIDATION_ERROR',
      });
    }
    if (payload.canFulfil === false && !String(payload.fulfilmentIssue ?? '').trim()) {
      throw new BadRequestException({
        message: 'fulfilmentIssue is required when cannot fulfil',
        code: 'VALIDATION_ERROR',
      });
    }
  }

  private validateDetailed(payload: DetailedReadinessPayload) {
    const strings = [
      'workDescription',
      'materialsRequired',
      'equipmentRequired',
    ] as const;
    for (const key of strings) {
      if (typeof payload[key] !== 'string' || !payload[key].trim()) {
        throw new BadRequestException({
          message: `Missing field: ${key}`,
          code: 'VALIDATION_ERROR',
        });
      }
    }
    for (const key of [
      'specificationsConfirmed',
      'skillsConfirmed',
      'capacityConfirmed',
      'matchesCustomerRequirements',
    ] as const) {
      if (payload[key] !== true) {
        throw new BadRequestException({
          message: `${key} must be confirmed`,
          code: 'VALIDATION_ERROR',
        });
      }
    }
    if (
      typeof payload.estimatedMaterialCost !== 'number' ||
      payload.estimatedMaterialCost < 0
    ) {
      throw new BadRequestException({
        message: 'estimatedMaterialCost must be a non-negative number',
        code: 'VALIDATION_ERROR',
      });
    }
    if (
      typeof payload.proposedProductionDays !== 'number' ||
      payload.proposedProductionDays < 1
    ) {
      throw new BadRequestException({
        message: 'proposedProductionDays must be at least 1',
        code: 'VALIDATION_ERROR',
      });
    }
    if (
      !Array.isArray(payload.productionSteps) ||
      payload.productionSteps.filter((s) => String(s).trim()).length < 1
    ) {
      throw new BadRequestException({
        message: 'At least one production step is required',
        code: 'VALIDATION_ERROR',
      });
    }
  }

  async submitAssessment(
    user: AccessTokenPayload,
    orderId: number,
    body: SubmitReadinessBody,
    files: Express.Multer.File[] = [],
  ) {
    if (user.role !== 'artisan') {
      throw new ForbiddenException({
        message: 'Only the assigned artisan can submit readiness',
        code: 'FORBIDDEN',
      });
    }

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException({
        message: 'Order not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    if (order.providerId !== user.sub) {
      throw new ForbiddenException({
        message: 'You cannot submit readiness for another artisan’s order',
        code: 'FORBIDDEN',
      });
    }
    if (!order.readinessWorkflowStatus) {
      throw new BadRequestException({
        message: 'This order is not in the readiness workflow',
        code: 'VALIDATION_ERROR',
      });
    }

    const openStatuses = new Set([
      'awaiting_response',
      'overdue',
      'changes_requested',
    ]);
    if (!openStatuses.has(order.readinessWorkflowStatus)) {
      throw new ConflictException({
        message: `Cannot submit while readiness status is "${order.readinessWorkflowStatus}"`,
        code: 'CONFLICT',
      });
    }

    const active = await this.prisma.orderReadinessAssessment.findFirst({
      where: {
        orderId,
        status: { in: ['submitted', 'under_review', 'approved'] },
      },
    });
    if (active && order.readinessWorkflowStatus !== 'changes_requested') {
      throw new ConflictException({
        message: 'An active assessment already exists for this order',
        code: 'CONFLICT',
      });
    }

    const cannotFulfil = body.cannotFulfil === true;
    if (!cannotFulfil && body.acknowledgedRequirements !== true) {
      throw new BadRequestException({
        message: 'You must review and acknowledge the order requirements',
        code: 'VALIDATION_ERROR',
      });
    }
    if (cannotFulfil && !String(body.cannotFulfilReason ?? '').trim()) {
      throw new BadRequestException({
        message: 'cannotFulfilReason is required',
        code: 'VALIDATION_ERROR',
      });
    }

    const type = this.resolveAssessmentType(order);
    if (!cannotFulfil) {
      if (type === 'standard') {
        this.validateStandard(body.payload as StandardReadinessPayload);
      } else {
        this.validateDetailed(body.payload as DetailedReadinessPayload);
      }
    }

    if (files.length && !isCloudinaryConfigured()) {
      throw new ServiceUnavailableException({
        message:
          'Attachments require Cloudinary. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
        code: 'STORAGE_NOT_CONFIGURED',
      });
    }

    const latest = await this.prisma.orderReadinessAssessment.findFirst({
      where: { orderId },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    if (latest && ['submitted', 'changes_requested', 'draft'].includes(latest.status)) {
      if (latest.status === 'submitted') {
        await this.prisma.orderReadinessAssessment.update({
          where: { id: latest.id },
          data: { status: 'superseded' },
        });
      } else if (latest.status === 'changes_requested') {
        await this.prisma.orderReadinessAssessment.update({
          where: { id: latest.id },
          data: { status: 'superseded' },
        });
      }
    }

    const now = new Date();
    const assessmentStatus = cannotFulfil ? 'cannot_fulfil' : 'submitted';
    const workflowStatus: ReadinessWorkflowStatus = cannotFulfil
      ? 'cannot_fulfil'
      : 'submitted';

    const assessment = await this.prisma.orderReadinessAssessment.create({
      data: {
        orderId,
        version: nextVersion,
        type,
        status: assessmentStatus,
        artisanId: user.sub,
        payload: (body.payload ?? {}) as object,
        cannotFulfil,
        cannotFulfilReason: cannotFulfil
          ? String(body.cannotFulfilReason).trim()
          : null,
        acknowledgedRequirements: body.acknowledgedRequirements === true,
        reviewedRequirementsAt: body.reviewedRequirementsAt
          ? new Date(body.reviewedRequirementsAt)
          : now,
        submittedAt: now,
        evidence: {
          create: files.map((file) => ({
            attachmentPublicId: cloudinaryPublicId(file),
            attachmentResourceType: cloudinaryResourceType(file, file.mimetype),
            attachmentName: file.originalname || 'attachment',
            attachmentMimeType: file.mimetype,
            attachmentBytes: file.size ?? null,
            attachmentKind: messageAttachmentKind(file.mimetype),
            durationMs: null,
          })),
        },
      },
      include: {
        evidence: true,
        reviews: true,
      },
    });

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        readinessWorkflowStatus: workflowStatus,
      },
    });

    await this.appendEvent(orderId, user.sub, cannotFulfil ? 'cannot_fulfil' : 'submitted', {
      assessmentId: assessment.id,
      version: nextVersion,
    });

    const admins = await this.prisma.user.findMany({
      where: {
        status: 'active',
        roles: { some: { role: { name: 'admin' } } },
      },
      select: { id: true },
      take: 50,
    });
    await Promise.all(
      admins.map((admin) =>
        this.notifications.notifyReadinessSubmitted(
          admin.id,
          orderId,
          order.productName ?? `Order #${orderId}`,
          assessment.id,
        ),
      ),
    );

    return this.assessmentDto(orderId, assessment);
  }

  async adminDecide(
    admin: AccessTokenPayload,
    orderId: number,
    assessmentId: number,
    body: AdminReadinessDecisionBody,
  ) {
    if (admin.role !== 'admin') {
      throw new ForbiddenException({ message: 'Forbidden', code: 'FORBIDDEN' });
    }
    const decision = body.decision;
    if (!['approve', 'request_changes', 'reject'].includes(decision)) {
      throw new BadRequestException({
        message: 'Invalid decision',
        code: 'VALIDATION_ERROR',
      });
    }
    if (
      (decision === 'request_changes' || decision === 'reject') &&
      !String(body.reason ?? '').trim()
    ) {
      throw new BadRequestException({
        message: 'A reason is required',
        code: 'VALIDATION_ERROR',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const assessment = await tx.orderReadinessAssessment.findFirst({
        where: { id: assessmentId, orderId },
      });
      if (!assessment) {
        throw new NotFoundException({
          message: 'Assessment not found',
          code: 'RESOURCE_NOT_FOUND',
        });
      }
      if (!['submitted', 'changes_requested'].includes(assessment.status)) {
        // Allow review of submitted; if already decided, conflict
        if (['approved', 'rejected'].includes(assessment.status)) {
          throw new ConflictException({
            message: 'Assessment already decided',
            code: 'CONFLICT',
          });
        }
      }
      if (assessment.status !== 'submitted' && assessment.status !== 'changes_requested') {
        // Only freshly submitted (or returned then re-submitted — those are new versions with submitted)
        if (assessment.status !== 'submitted') {
          throw new ConflictException({
            message: `Cannot review assessment in status "${assessment.status}"`,
            code: 'CONFLICT',
          });
        }
      }

      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order?.providerId) {
        throw new NotFoundException({
          message: 'Order not found',
          code: 'RESOURCE_NOT_FOUND',
        });
      }

      const nextAssessmentStatus =
        decision === 'approve'
          ? 'approved'
          : decision === 'reject'
            ? 'rejected'
            : 'changes_requested';
      const nextWorkflow: ReadinessWorkflowStatus =
        decision === 'approve'
          ? 'approved'
          : decision === 'reject'
            ? 'rejected'
            : 'changes_requested';

      const updated = await tx.orderReadinessAssessment.updateMany({
        where: {
          id: assessmentId,
          status: 'submitted',
        },
        data: { status: nextAssessmentStatus },
      });
      if (updated.count !== 1) {
        throw new ConflictException({
          message: 'Assessment was already reviewed',
          code: 'CONFLICT',
        });
      }

      await tx.orderReadinessReview.create({
        data: {
          assessmentId,
          reviewerId: admin.sub,
          decision,
          reason: body.reason?.trim() || null,
        },
      });

      await tx.order.update({
        where: { id: orderId },
        data: { readinessWorkflowStatus: nextWorkflow },
      });

      await tx.orderReadinessEvent.create({
        data: {
          orderId,
          actorId: admin.sub,
          action:
            decision === 'approve'
              ? 'approved'
              : decision === 'reject'
                ? 'rejected'
                : 'changes_requested',
          detail: {
            assessmentId,
            reason: body.reason?.trim() || null,
            // Phase 1: approval means Approved — Awaiting Initial Payout (no payout trigger).
            nextStage:
              decision === 'approve'
                ? 'approved_awaiting_initial_payout'
                : null,
          },
        },
      });

      return {
        orderId,
        assessmentId,
        decision,
        workflowStatus: nextWorkflow,
        reviewerId: admin.sub,
        reviewedAt: new Date().toISOString(),
        providerId: order.providerId,
        productName: order.productName,
        currency: order.currency,
        payload: assessment.payload,
        reason: body.reason?.trim() || null,
      };
    }).then(async (result) => {
      if (result.decision === 'approve') {
        await this.artisanPayouts.ensurePayoutAfterReadinessApproval({
          orderId: result.orderId,
          assessmentId: result.assessmentId,
          currency: result.currency || 'NGN',
          payload: result.payload,
          actorId: result.reviewerId,
        });
        await this.notifications.notifyReadinessApproved(
          result.providerId,
          result.orderId,
          result.productName ?? `Order #${result.orderId}`,
        );
      } else if (result.decision === 'request_changes') {
        await this.notifications.notifyReadinessChangesRequested(
          result.providerId,
          result.orderId,
          result.productName ?? `Order #${result.orderId}`,
          result.reason ?? '',
        );
      } else {
        await this.notifications.notifyReadinessRejected(
          result.providerId,
          result.orderId,
          result.productName ?? `Order #${result.orderId}`,
          result.reason ?? '',
        );
      }
      return result;
    });
  }

  async extendDeadline(
    admin: AccessTokenPayload,
    orderId: number,
    body: AdminExtendDeadlineBody,
  ) {
    if (admin.role !== 'admin') {
      throw new ForbiddenException({ message: 'Forbidden', code: 'FORBIDDEN' });
    }
    const hours = Number(body.extraHours);
    if (!Number.isFinite(hours) || hours < 1 || hours > 168) {
      throw new BadRequestException({
        message: 'extraHours must be between 1 and 168',
        code: 'VALIDATION_ERROR',
      });
    }
    if (!String(body.reason ?? '').trim()) {
      throw new BadRequestException({
        message: 'reason is required',
        code: 'VALIDATION_ERROR',
      });
    }

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order?.readinessResponseDeadline) {
      throw new NotFoundException({
        message: 'Order readiness deadline not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    const base =
      order.readinessResponseDeadline.getTime() > Date.now()
        ? order.readinessResponseDeadline
        : new Date();
    const nextDeadline = new Date(base.getTime() + hours * 60 * 60 * 1000);
    const nextStatus: ReadinessWorkflowStatus =
      order.readinessWorkflowStatus === 'overdue' ||
      order.readinessWorkflowStatus === 'awaiting_response'
        ? 'awaiting_response'
        : (order.readinessWorkflowStatus as ReadinessWorkflowStatus);

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        readinessResponseDeadline: nextDeadline,
        readinessDeadlineExtendedAt: new Date(),
        readinessExtensionHours: hours,
        readinessExtensionReason: body.reason.trim(),
        readinessExtensionById: admin.sub,
        readinessWorkflowStatus:
          order.readinessWorkflowStatus === 'overdue'
            ? 'awaiting_response'
            : order.readinessWorkflowStatus,
      },
    });

    await this.appendEvent(orderId, admin.sub, 'extended', {
      extraHours: hours,
      reason: body.reason.trim(),
      newDeadline: nextDeadline.toISOString(),
      // Explicit: extension does not auto-apply a penalty.
      penaltyApplied: false,
    });

    if (order.providerId) {
      await this.notifications.notifyReadinessDeadlineExtended(
        order.providerId,
        orderId,
        order.productName ?? `Order #${orderId}`,
        nextDeadline,
        hours,
      );
    }

    return {
      orderId,
      responseDeadline: updated.readinessResponseDeadline?.toISOString(),
      workflowStatus: updated.readinessWorkflowStatus,
      extensionHours: hours,
      penaltyApplied: false,
      nextStatus,
    };
  }

  async getEvidenceAccess(
    user: AccessTokenPayload,
    orderId: number,
    assessmentId: number,
    evidenceId: number,
  ) {
    await this.getOwnedOrder(user, orderId);
    const evidence = await this.prisma.orderReadinessEvidence.findFirst({
      where: {
        id: evidenceId,
        assessmentId,
        assessment: { orderId },
      },
    });
    if (!evidence) {
      throw new NotFoundException({
        message: 'Evidence not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    if (!isCloudinaryConfigured()) {
      throw new ServiceUnavailableException({
        message: 'Cloudinary is not configured',
        code: 'STORAGE_NOT_CONFIGURED',
      });
    }
    return {
      url: signedAuthenticatedUrl(
        evidence.attachmentPublicId,
        evidence.attachmentResourceType || 'image',
        120,
      ),
      name: evidence.attachmentName,
      mimeType: evidence.attachmentMimeType,
      kind: evidence.attachmentKind,
      expiresInSeconds: 120,
    };
  }

  async listAdmin(filter?: AdminReadinessFilter | string, page = 1, pageSize = 20) {
    const where: Record<string, unknown> = {
      readinessWorkflowStatus: { not: null },
    };
    if (filter && filter !== 'all') {
      where.readinessWorkflowStatus = filter;
    }
    const skip = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, pageSize));
    const take = Math.min(100, Math.max(1, pageSize));
    const [totalItems, rows] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { readinessResponseDeadline: 'asc' },
        skip,
        take,
        include: {
          readinessAssessments: {
            orderBy: { version: 'desc' },
            take: 1,
            include: { reviews: { orderBy: { createdAt: 'desc' }, take: 1 } },
          },
          artisanPayout: {
            include: {
              transfers: {
                select: { amount: true, currency: true, status: true },
              },
            },
          },
        },
      }),
    ]);

    return {
      data: rows.map((order) => ({
        id: order.id,
        productName: order.productName,
        providerId: order.providerId,
        providerName: order.providerName,
        customerId: order.customerId,
        price: order.price,
        currency: order.currency,
        status: order.status,
        isCustomOrder: order.isCustomOrder,
        readiness: this.readinessSummary(order),
        production: this.artisanPayouts.payoutSummaryForOrder(order),
        latestAssessment: order.readinessAssessments[0]
          ? this.assessmentDto(order.id, {
              ...order.readinessAssessments[0],
              evidence: [],
            })
          : null,
        createdAt: order.createdAt.toISOString(),
      })),
      pagination: {
        page,
        pageSize: take,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / take)),
      },
      highValueThresholdNgn: this.highValueThresholdNgn(),
    };
  }

  /** Cron: 12h / 20h reminders and overdue escalation. Controllable via `now`. */
  async processDeadlines(now = new Date()) {
    const open = await this.prisma.order.findMany({
      where: {
        readinessWorkflowStatus: { in: ['awaiting_response', 'overdue'] },
        readinessAssignedAt: { not: null },
        readinessResponseDeadline: { not: null },
        providerId: { not: null },
      },
    });

    let reminders12 = 0;
    let reminders20 = 0;
    let overdue = 0;

    for (const order of open) {
      const assigned = order.readinessAssignedAt!;
      const deadline = order.readinessResponseDeadline!;
      const elapsedMs = now.getTime() - assigned.getTime();
      const hoursElapsed = elapsedMs / (60 * 60 * 1000);

      if (
        hoursElapsed >= READINESS_REMINDER_12H_HOURS &&
        now < deadline &&
        order.readinessWorkflowStatus === 'awaiting_response'
      ) {
        const created = await this.tryReminder(order.id, 'reminder_12h');
        if (created && order.providerId) {
          await this.notifications.notifyReadinessReminder(
            order.providerId,
            order.id,
            order.productName ?? `Order #${order.id}`,
            deadline,
            12,
          );
          reminders12 += 1;
        }
      }

      if (
        hoursElapsed >= READINESS_REMINDER_20H_HOURS &&
        now < deadline &&
        order.readinessWorkflowStatus === 'awaiting_response'
      ) {
        const created = await this.tryReminder(order.id, 'reminder_20h');
        if (created && order.providerId) {
          await this.notifications.notifyReadinessReminder(
            order.providerId,
            order.id,
            order.productName ?? `Order #${order.id}`,
            deadline,
            20,
          );
          reminders20 += 1;
        }
      }

      if (now >= deadline && order.readinessWorkflowStatus === 'awaiting_response') {
        const created = await this.tryReminder(order.id, 'overdue');
        if (created) {
          await this.prisma.order.update({
            where: { id: order.id },
            data: { readinessWorkflowStatus: 'overdue' },
          });
          await this.appendEvent(order.id, null, 'overdue', {
            deadline: deadline.toISOString(),
            autoCancelled: false,
            penaltyApplied: false,
          });
          const admins = await this.prisma.user.findMany({
            where: {
              status: 'active',
              roles: { some: { role: { name: 'admin' } } },
            },
            select: { id: true },
            take: 50,
          });
          await Promise.all(
            admins.map((admin) =>
              this.notifications.notifyReadinessOverdue(
                admin.id,
                order.id,
                order.productName ?? `Order #${order.id}`,
                order.providerName ?? 'Artisan',
              ),
            ),
          );
          if (order.providerId) {
            await this.notifications.notifyReadinessOverdueArtisan(
              order.providerId,
              order.id,
              order.productName ?? `Order #${order.id}`,
            );
          }
          overdue += 1;
        }
      }
    }

    return { scanned: open.length, reminders12, reminders20, overdue };
  }

  private async tryReminder(orderId: number, kind: string): Promise<boolean> {
    try {
      await this.prisma.orderReadinessReminder.create({
        data: { orderId, kind },
      });
      return true;
    } catch {
      return false;
    }
  }

  isNewOrdersCandidate(order: {
    readinessWorkflowStatus: string | null;
    status: string;
  }) {
    if (
      order.readinessWorkflowStatus &&
      NEW_ORDERS_READINESS_STATUSES.includes(
        order.readinessWorkflowStatus as ReadinessWorkflowStatus,
      )
    ) {
      return order.status !== 'cancelled' && order.status !== 'rejected';
    }
    return order.status === 'pending';
  }

  /**
   * Phase 2: readiness-workflow orders may only enter production via Start Work
   * after verified initial payout (or audited funding-not-required).
   */
  async assertProductionStartAllowed(order: {
    id: number;
    readinessWorkflowStatus: string | null;
    productionStartedAt?: Date | null;
  }) {
    await this.artisanPayouts.assertProductionStartAllowed({
      id: order.id,
      readinessWorkflowStatus: order.readinessWorkflowStatus,
      productionStartedAt: order.productionStartedAt ?? null,
    });
  }
}
