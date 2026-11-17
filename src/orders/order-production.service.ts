import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import {
  cloudinaryPublicId,
  cloudinaryResourceType,
  messageAttachmentKind,
} from '../upload/multer.config';
import { signedAuthenticatedUrl } from '../upload/cloudinary';

@Injectable()
export class OrderProductionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async assertCanView(user: AccessTokenPayload, orderId: number) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException({ message: 'Order not found', code: 'RESOURCE_NOT_FOUND' });
    }
    if (user.role === 'admin') return order;
    if (user.role === 'artisan' && order.providerId === user.sub) return order;
    if (user.role === 'customer' && order.customerId === user.sub) return order;
    throw new ForbiddenException({ message: 'Forbidden', code: 'FORBIDDEN' });
  }

  countdownFields(order: {
    productionStartedAt: Date | null;
    productionDeadline: Date | null;
    productionOriginalDeadline: Date | null;
    productionDurationDays: number | null;
  }, now = new Date()) {
    if (!order.productionStartedAt) return null;
    const started = order.productionStartedAt.getTime();
    const deadline = order.productionDeadline?.getTime() ?? null;
    const msElapsed = Math.max(0, now.getTime() - started);
    const msRemaining = deadline != null ? deadline - now.getTime() : null;
    return {
      productionStartedAt: order.productionStartedAt.toISOString(),
      productionDeadline: order.productionDeadline?.toISOString() ?? null,
      productionOriginalDeadline:
        order.productionOriginalDeadline?.toISOString() ??
        order.productionDeadline?.toISOString() ??
        null,
      productionDurationDays: order.productionDurationDays,
      msElapsed,
      msRemaining,
      overdue: msRemaining != null ? msRemaining <= 0 : false,
    };
  }

  async getBundle(user: AccessTokenPayload, orderId: number) {
    const order = await this.assertCanView(user, orderId);
    const [updates, extensions, events] = await Promise.all([
      this.prisma.orderProductionProgressUpdate.findMany({
        where: { orderId },
        include: { evidence: { orderBy: { id: 'asc' } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.orderProductionDeadlineExtension.findMany({
        where: { orderId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.orderProductionEvent.findMany({
        where: { orderId },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return {
      orderId,
      status: order.status,
      qualityReviewStatus: order.qualityReviewStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      countdown: this.countdownFields(order),
      progress: updates.map((u) => ({
        id: u.id,
        artisanId: u.artisanId,
        note: u.note,
        percentComplete: u.percentComplete,
        createdAt: u.createdAt.toISOString(),
        evidence: u.evidence.map((e) => ({
          id: e.id,
          name: e.attachmentName,
          mimeType: e.attachmentMimeType,
          kind: e.attachmentKind,
          bytes: e.attachmentBytes,
          durationMs: e.durationMs,
          url: `/orders/${orderId}/production/progress/${u.id}/evidence/${e.id}`,
        })),
      })),
      extensions: extensions.map((x) => ({
        id: x.id,
        previousDeadline: x.previousDeadline.toISOString(),
        newDeadline: x.newDeadline.toISOString(),
        extraHours: x.extraHours,
        reason: x.reason,
        extendedById: x.extendedById,
        createdAt: x.createdAt.toISOString(),
      })),
      events: events.map((ev) => ({
        id: ev.id,
        action: ev.action,
        actorId: ev.actorId,
        detail: ev.detail,
        createdAt: ev.createdAt.toISOString(),
      })),
    };
  }

  async submitProgress(
    user: AccessTokenPayload,
    orderId: number,
    body: { note?: string; percentComplete?: number },
    files: Express.Multer.File[] = [],
  ) {
    if (user.role !== 'artisan') {
      throw new ForbiddenException({ message: 'Forbidden', code: 'FORBIDDEN' });
    }
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.providerId !== user.sub) {
      throw new ForbiddenException({ message: 'Forbidden', code: 'FORBIDDEN' });
    }
    if (!order.productionStartedAt) {
      throw new BadRequestException({
        message: 'Production has not started',
        code: 'PRODUCTION_NOT_STARTED',
      });
    }
    if (!body.note?.trim()) {
      throw new BadRequestException({
        message: 'Progress note is required',
        code: 'VALIDATION_ERROR',
      });
    }
    let percent: number | null = null;
    if (body.percentComplete != null) {
      const n = Number(body.percentComplete);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        throw new BadRequestException({
          message: 'percentComplete must be 0-100',
          code: 'VALIDATION_ERROR',
        });
      }
      percent = Math.round(n);
    }

    const created = await this.prisma.orderProductionProgressUpdate.create({
      data: {
        orderId,
        artisanId: user.sub,
        note: body.note.trim(),
        percentComplete: percent,
        evidence: {
          create: (files ?? []).map((file) => ({
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

    await this.prisma.orderProductionEvent.create({
      data: {
        orderId,
        actorId: user.sub,
        action: 'progress_submitted',
        detail: {
          progressUpdateId: created.id,
          percentComplete: percent,
          evidenceCount: created.evidence.length,
        },
      },
    });

    const admins = await this.prisma.user.findMany({
      where: { roles: { some: { role: { name: 'admin' } } } },
      select: { id: true },
      take: 20,
    });
    await Promise.all(
      admins.map((a) =>
        this.notifications.notifyProductionProgress(
          a.id,
          orderId,
          order.productName ?? `Order #${orderId}`,
        ),
      ),
    );

    return created;
  }

  async getProgressEvidenceAccess(
    user: AccessTokenPayload,
    orderId: number,
    progressId: number,
    evidenceId: number,
  ) {
    await this.assertCanView(user, orderId);
    const evidence = await this.prisma.orderProductionProgressEvidence.findFirst({
      where: {
        id: evidenceId,
        progressUpdateId: progressId,
        progressUpdate: { orderId },
      },
    });
    if (!evidence) {
      throw new NotFoundException({ message: 'Evidence not found', code: 'RESOURCE_NOT_FOUND' });
    }
    return {
      url: signedAuthenticatedUrl(
        evidence.attachmentPublicId,
        evidence.attachmentResourceType,
      ),
    };
  }

  async extendDeadline(
    admin: AccessTokenPayload,
    orderId: number,
    body: { extraHours: number; reason: string },
  ) {
    if (admin.role !== 'admin') {
      throw new ForbiddenException({ message: 'Forbidden', code: 'FORBIDDEN' });
    }
    if (!body.reason?.trim()) {
      throw new BadRequestException({
        message: 'Extension reason is required',
        code: 'VALIDATION_ERROR',
      });
    }
    const hours = Number(body.extraHours);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 720) {
      throw new BadRequestException({
        message: 'extraHours must be between 1 and 720',
        code: 'VALIDATION_ERROR',
      });
    }

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order?.productionStartedAt || !order.productionDeadline) {
      throw new BadRequestException({
        message: 'Order is not in active production',
        code: 'VALIDATION_ERROR',
      });
    }

    const previous = order.productionDeadline;
    const next = new Date(previous.getTime() + hours * 60 * 60 * 1000);
    const original = order.productionOriginalDeadline ?? previous;

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          productionDeadline: next,
          productionOriginalDeadline: original,
        },
      });
      await tx.orderProductionDeadlineExtension.create({
        data: {
          orderId,
          previousDeadline: previous,
          newDeadline: next,
          extraHours: hours,
          reason: body.reason.trim(),
          extendedById: admin.sub,
        },
      });
      await tx.orderProductionEvent.create({
        data: {
          orderId,
          actorId: admin.sub,
          action: 'deadline_extended',
          detail: {
            previousDeadline: previous.toISOString(),
            newDeadline: next.toISOString(),
            originalDeadline: original.toISOString(),
            extraHours: hours,
            reason: body.reason.trim(),
          },
        },
      });
    });

    if (order.providerId) {
      await this.notifications.notifyProductionDeadlineExtended(
        order.providerId,
        orderId,
        order.productName ?? `Order #${orderId}`,
        next,
        hours,
      );
    }

    return {
      orderId,
      productionOriginalDeadline: original.toISOString(),
      productionDeadline: next.toISOString(),
      extraHours: hours,
    };
  }

  async processDeadlines(now = new Date()) {
    const active = await this.prisma.order.findMany({
      where: {
        productionStartedAt: { not: null },
        productionDeadline: { not: null },
        status: { in: ['in_progress', 'confirmed'] },
        qualityReviewStatus: { notIn: ['approved', 'rejected'] },
      },
      select: {
        id: true,
        providerId: true,
        productName: true,
        productionStartedAt: true,
        productionDeadline: true,
      },
    });

    let overdue = 0;
    let reminders = 0;
    for (const order of active) {
      const deadline = order.productionDeadline!;
      const started = order.productionStartedAt!;
      const total = deadline.getTime() - started.getTime();
      const elapsed = now.getTime() - started.getTime();

      if (now >= deadline) {
        const created = await this.prisma.orderProductionReminder.createMany({
          data: [{ orderId: order.id, kind: 'overdue' }],
          skipDuplicates: true,
        });
        if (created.count === 1) {
          overdue += 1;
          await this.prisma.orderProductionEvent.create({
            data: {
              orderId: order.id,
              action: 'overdue',
              detail: { deadline: deadline.toISOString() },
            },
          });
          if (order.providerId) {
            await this.notifications.notifyProductionOverdueArtisan(
              order.providerId,
              order.id,
              order.productName ?? `Order #${order.id}`,
            );
          }
          const admins = await this.prisma.user.findMany({
            where: { roles: { some: { role: { name: 'admin' } } } },
            select: { id: true },
            take: 20,
          });
          await Promise.all(
            admins.map((a) =>
              this.notifications.notifyProductionOverdueAdmin(
                a.id,
                order.id,
                order.productName ?? `Order #${order.id}`,
              ),
            ),
          );
        }
      } else if (total > 0 && elapsed / total >= 0.5) {
        const created = await this.prisma.orderProductionReminder.createMany({
          data: [{ orderId: order.id, kind: 'reminder_50' }],
          skipDuplicates: true,
        });
        if (created.count === 1 && order.providerId) {
          reminders += 1;
          await this.notifications.notifyProductionHalfway(
            order.providerId,
            order.id,
            order.productName ?? `Order #${order.id}`,
            deadline,
          );
        }
      }
    }

    return { scanned: active.length, reminders, overdue };
  }

  async listAdmin(page = 1, pageSize = 30) {
    const take = Math.min(100, Math.max(1, pageSize));
    const skip = (Math.max(1, page) - 1) * take;
    const where = {
      productionStartedAt: { not: null },
      status: { in: ['in_progress', 'confirmed', 'ready'] },
    };
    const [totalItems, rows] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { productionDeadline: 'asc' },
        skip,
        take,
        include: {
          productionProgressUpdates: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
    ]);
    return {
      data: rows.map((o) => ({
        id: o.id,
        productName: o.productName,
        providerName: o.providerName,
        status: o.status,
        qualityReviewStatus: o.qualityReviewStatus,
        countdown: this.countdownFields(o),
        latestProgress: o.productionProgressUpdates[0]
          ? {
              note: o.productionProgressUpdates[0].note,
              percentComplete: o.productionProgressUpdates[0].percentComplete,
              createdAt: o.productionProgressUpdates[0].createdAt.toISOString(),
            }
          : null,
      })),
      pagination: {
        page,
        pageSize: take,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / take)),
      },
    };
  }
}
