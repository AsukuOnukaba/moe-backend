import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { CreateCustomOrderDto } from './dto/create-custom-order.dto';
import type { RespondCustomOrderDto } from './dto/respond-custom-order.dto';
import type { UpdateCustomOrderStatusDto } from './dto/update-custom-order-status.dto';
import { CustomOrderRankingService } from './custom-order-ranking.service';

const STATUS_TRANSITIONS: Record<string, string[]> = {
  accepted: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
};

@Injectable()
export class CustomOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService,
    private readonly ranking: CustomOrderRankingService,
  ) {}

  private toDto(row: {
    id: string;
    artisanId: number;
    customerId: number;
    description: string;
    referenceImages: string[];
    budget: number | null;
    budgetMin: number | null;
    budgetMax: number | null;
    deadline: Date | null;
    specialInstructions: string | null;
    categoryFields: unknown;
    status: string;
    artisanResponse: string | null;
    createdAt: Date;
    updatedAt: Date;
    artisan?: { brandName: string | null; businessName: string | null } | null;
    customer?: { name: string } | null;
  }) {
    return {
      id: row.id,
      artisanId: row.artisanId,
      customerId: row.customerId,
      description: row.description,
      referenceImages: row.referenceImages ?? [],
      budget: row.budget,
      budgetMin: row.budgetMin,
      budgetMax: row.budgetMax,
      deadline: row.deadline ? row.deadline.toISOString() : null,
      specialInstructions: row.specialInstructions,
      categoryFields: row.categoryFields ?? null,
      status: row.status,
      artisanResponse: row.artisanResponse,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      artisanName:
        row.artisan?.brandName || row.artisan?.businessName || undefined,
      customerName: row.customer?.name || undefined,
    };
  }

  private includeNames = {
    artisan: { select: { brandName: true, businessName: true } },
    customer: { select: { name: true } },
  } as const;

  async create(user: AccessTokenPayload, dto: CreateCustomOrderDto) {
    if (user.role !== 'customer') {
      throw new ForbiddenException({ message: 'Forbidden', code: 'FORBIDDEN' });
    }

    const artisan = await this.prisma.artisanProfile.findUnique({
      where: { userId: dto.artisanId },
      include: { user: { select: { email: true, name: true } } },
    });
    if (!artisan || artisan.status === 'deleted') {
      throw new NotFoundException({
        message: 'Artisan not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    const eligible =
      artisan.isCustomOrderEligible || artisan.customOrdersEnabled;
    if (!eligible) {
      throw new ForbiddenException({
        message: 'This artisan is not currently accepting custom orders',
        code: 'FORBIDDEN',
      });
    }

    const budgetMin = dto.budgetMin ?? null;
    const budgetMax = dto.budgetMax ?? dto.budget ?? null;
    if (
      budgetMin != null &&
      budgetMax != null &&
      budgetMin > budgetMax
    ) {
      throw new BadRequestException({
        message: 'Minimum budget cannot exceed maximum budget',
        code: 'VALIDATION_ERROR',
      });
    }

    let deadline: Date | null = null;
    if (dto.deadline) {
      deadline = new Date(dto.deadline);
      const minDeadline = new Date();
      minDeadline.setHours(0, 0, 0, 0);
      minDeadline.setDate(minDeadline.getDate() + 7);
      if (deadline < minDeadline) {
        throw new BadRequestException({
          message: 'Deadline must be at least 7 days from today',
          code: 'VALIDATION_ERROR',
        });
      }
    }

    const customer = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { name: true },
    });
    const customerName = customer?.name?.trim() || 'A customer';
    const artisanName =
      artisan.brandName || artisan.businessName || artisan.user.name;

    const row = await this.prisma.customOrder.create({
      data: {
        artisanId: dto.artisanId,
        customerId: user.sub,
        description: dto.description.trim(),
        referenceImages: dto.referenceImages ?? [],
        budget: budgetMax,
        budgetMin,
        budgetMax,
        deadline,
        specialInstructions: dto.specialInstructions?.trim() || null,
        categoryFields: (dto.categoryFields as object) ?? undefined,
        status: 'pending',
      },
      include: this.includeNames,
    });

    const artisanBody = `You have a new custom order request from ${customerName}. Log in to review and respond.`;
    await this.notifications.create({
      userId: dto.artisanId,
      type: 'system',
      title: 'New custom order request',
      body: artisanBody,
      link: '/artisan/dashboard',
      idempotencyKey: `custom-order-created:${row.id}`,
      bodyMaxLength: 200,
    });

    try {
      await this.email.send({
        to: artisan.user.email,
        subject: 'New custom order request — MOE Africa',
        html: `<p>${artisanBody}</p>`,
        text: artisanBody,
      });
    } catch {
      // email is best-effort
    }

    await this.notifications.create({
      userId: user.sub,
      type: 'system',
      title: 'Custom order sent',
      body: `Your custom order request has been sent to ${artisanName}. They will respond within 48 hours.`,
      link: '/marketplace/orders',
      idempotencyKey: `custom-order-customer-confirm:${row.id}`,
      bodyMaxLength: 200,
    });

    return this.toDto(row);
  }

  async listForArtisan(user: AccessTokenPayload) {
    if (user.role !== 'artisan') {
      throw new ForbiddenException({ message: 'Forbidden', code: 'FORBIDDEN' });
    }
    const rows = await this.prisma.customOrder.findMany({
      where: { artisanId: user.sub },
      include: this.includeNames,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  async listForCustomer(user: AccessTokenPayload) {
    if (user.role !== 'customer') {
      throw new ForbiddenException({ message: 'Forbidden', code: 'FORBIDDEN' });
    }
    const rows = await this.prisma.customOrder.findMany({
      where: { customerId: user.sub },
      include: this.includeNames,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  async respond(
    user: AccessTokenPayload,
    id: string,
    dto: RespondCustomOrderDto,
  ) {
    if (user.role !== 'artisan') {
      throw new ForbiddenException({ message: 'Forbidden', code: 'FORBIDDEN' });
    }
    const existing = await this.prisma.customOrder.findUnique({ where: { id } });
    if (!existing || existing.artisanId !== user.sub) {
      throw new NotFoundException({
        message: 'Custom order not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    if (existing.status !== 'pending') {
      throw new BadRequestException({
        message: 'Only pending custom orders can be accepted or declined',
        code: 'VALIDATION_ERROR',
      });
    }

    const status = dto.action === 'accept' ? 'accepted' : 'declined';
    const row = await this.prisma.customOrder.update({
      where: { id },
      data: {
        status,
        artisanResponse: dto.response.trim(),
      },
      include: this.includeNames,
    });

    const artisanName =
      row.artisan?.brandName || row.artisan?.businessName || 'the artisan';
    await this.notifications.create({
      userId: existing.customerId,
      type: 'system',
      title:
        status === 'accepted'
          ? 'Custom order accepted'
          : 'Custom order declined',
      body:
        status === 'accepted'
          ? `${artisanName} accepted your custom order request.`
          : `${artisanName} declined your custom order request.`,
      link: '/marketplace/orders',
      idempotencyKey: `custom-order-${status}:${id}`,
    });

    try {
      await this.ranking.calculateRank(existing.artisanId);
    } catch {
      // ranking is best-effort
    }

    return this.toDto(row);
  }

  async updateStatus(
    user: AccessTokenPayload,
    id: string,
    dto: UpdateCustomOrderStatusDto,
  ) {
    if (user.role !== 'artisan') {
      throw new ForbiddenException({ message: 'Forbidden', code: 'FORBIDDEN' });
    }
    const existing = await this.prisma.customOrder.findUnique({ where: { id } });
    if (!existing || existing.artisanId !== user.sub) {
      throw new NotFoundException({
        message: 'Custom order not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    const allowed = STATUS_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException({
        message: `Cannot transition from '${existing.status}' to '${dto.status}'`,
        code: 'VALIDATION_ERROR',
      });
    }

    const row = await this.prisma.customOrder.update({
      where: { id },
      data: { status: dto.status },
      include: this.includeNames,
    });

    const artisanName =
      row.artisan?.brandName || row.artisan?.businessName || 'the artisan';
    await this.notifications.create({
      userId: existing.customerId,
      type: 'system',
      title: 'Custom order updated',
      body: `${artisanName} updated your custom order status to ${dto.status.replace('_', ' ')}.`,
      link: '/marketplace/orders',
      idempotencyKey: `custom-order-status:${id}:${dto.status}`,
    });

    if (dto.status === 'completed' || dto.status === 'cancelled') {
      try {
        await this.ranking.calculateRank(existing.artisanId);
      } catch {
        // ranking is best-effort
      }
    }

    return this.toDto(row);
  }

  async listAdmin(query?: {
    page?: number;
    pageSize?: number;
    status?: string;
    artisanId?: number;
  }) {
    const page = Math.max(1, Number(query?.page ?? 1));
    const pageSize = Math.min(Math.max(Number(query?.pageSize ?? 20), 1), 100);
    const where: {
      status?: string;
      artisanId?: number;
    } = {};
    if (query?.status) where.status = query.status;
    if (query?.artisanId) where.artisanId = query.artisanId;

    const [total, rows] = await Promise.all([
      this.prisma.customOrder.count({ where }),
      this.prisma.customOrder.findMany({
        where,
        include: this.includeNames,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      total,
      page,
      pageSize,
      items: rows.map((r) => ({
        id: r.id,
        artisanId: r.artisanId,
        customerId: r.customerId,
        artisanName:
          r.artisan?.brandName || r.artisan?.businessName || null,
        customerName: r.customer?.name ?? null,
        description: r.description,
        budget: r.budget,
        budgetMin: r.budgetMin,
        budgetMax: r.budgetMax,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        categoryFieldsSummary: summarizeCategoryFields(r.categoryFields),
      })),
    };
  }

  async getAdminById(id: string) {
    const row = await this.prisma.customOrder.findUnique({
      where: { id },
      include: this.includeNames,
    });
    if (!row) {
      throw new NotFoundException({
        message: 'Custom order not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    return this.toDto(row);
  }

  async setEligibility(
    adminUserId: number,
    artisanId: number,
    isEligible: boolean,
  ) {
    const profile = await this.prisma.artisanProfile.findUnique({
      where: { userId: artisanId },
      include: { user: { select: { email: true, name: true } } },
    });
    if (!profile || profile.status === 'deleted') {
      throw new NotFoundException({
        message: 'Artisan not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    const updated = await this.prisma.artisanProfile.update({
      where: { userId: artisanId },
      data: {
        isCustomOrderEligible: isEligible,
        customOrdersEnabled: isEligible,
        customOrderApprovedAt: isEligible ? new Date() : null,
        customOrderApprovedBy: isEligible ? String(adminUserId) : null,
      },
    });

    const title = isEligible
      ? 'Approved for custom orders'
      : 'Custom order eligibility removed';
    const body = isEligible
      ? 'You have been approved to accept custom orders on MOE Africa. Customers can now request bespoke commissions from your profile.'
      : 'Your custom order eligibility has been removed. Existing custom orders will not be affected.';

    await this.notifications.create({
      userId: artisanId,
      type: 'system',
      title,
      body,
      link: '/artisan/dashboard',
      idempotencyKey: `custom-order-eligibility:${artisanId}:${isEligible}:${updated.updatedAt.getTime()}`,
    });

    try {
      await this.email.send({
        to: profile.user.email,
        subject: title,
        html: `<p>${body}</p>`,
        text: body,
      });
    } catch {
      // email is best-effort
    }

    if (isEligible) {
      try {
        await this.ranking.calculateRank(artisanId);
      } catch {
        // ranking is best-effort
      }
    }

    return {
      isCustomOrderEligible: updated.isCustomOrderEligible,
      customOrderApprovedAt: updated.customOrderApprovedAt
        ? updated.customOrderApprovedAt.toISOString()
        : null,
      customOrderApprovedBy: updated.customOrderApprovedBy,
    };
  }
}

function summarizeCategoryFields(fields: unknown): Record<string, unknown> | null {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return null;
  const obj = fields as Record<string, unknown>;
  const keys = Object.keys(obj).slice(0, 8);
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const v = obj[k];
    if (v !== null && typeof v === 'object') {
      out[k] = Array.isArray(v) ? `[${v.length} items]` : '{…}';
    } else {
      out[k] = v;
    }
  }
  return out;
}
