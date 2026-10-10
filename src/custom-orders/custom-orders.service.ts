import {
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

@Injectable()
export class CustomOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService,
  ) {}

  private toDto(row: {
    id: string;
    artisanId: number;
    customerId: number;
    description: string;
    referenceImages: string[];
    budget: number | null;
    deadline: string | null;
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
      deadline: row.deadline,
      status: row.status,
      artisanResponse: row.artisanResponse,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      artisanName:
        row.artisan?.brandName || row.artisan?.businessName || undefined,
      customerName: row.customer?.name || undefined,
    };
  }

  async create(user: AccessTokenPayload, dto: CreateCustomOrderDto) {
    if (user.role !== 'customer') {
      throw new ForbiddenException({ message: 'Forbidden', code: 'FORBIDDEN' });
    }
    const artisan = await this.prisma.artisanProfile.findUnique({
      where: { userId: dto.artisanId },
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
        message: 'This artisan is not eligible for custom orders',
        code: 'FORBIDDEN',
      });
    }

    const row = await this.prisma.customOrder.create({
      data: {
        artisanId: dto.artisanId,
        customerId: user.sub,
        description: dto.description.trim(),
        referenceImages: dto.referenceImages ?? [],
        budget: dto.budget ?? null,
        deadline: dto.deadline ?? null,
        status: 'pending',
      },
      include: {
        artisan: { select: { brandName: true, businessName: true } },
        customer: { select: { name: true } },
      },
    });

    await this.notifications.create({
      userId: dto.artisanId,
      type: 'system',
      title: 'New custom order request',
      body: 'A customer requested a bespoke commission. Respond within 48 hours.',
      link: '/artisan/dashboard',
      idempotencyKey: `custom-order-created:${row.id}`,
    });

    return this.toDto(row);
  }

  async listForArtisan(user: AccessTokenPayload) {
    if (user.role !== 'artisan') {
      throw new ForbiddenException({ message: 'Forbidden', code: 'FORBIDDEN' });
    }
    const rows = await this.prisma.customOrder.findMany({
      where: { artisanId: user.sub },
      include: {
        artisan: { select: { brandName: true, businessName: true } },
        customer: { select: { name: true } },
      },
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
    const row = await this.prisma.customOrder.update({
      where: { id },
      data: {
        status: dto.status,
        artisanResponse: dto.artisanResponse?.trim() || null,
      },
      include: {
        artisan: { select: { brandName: true, businessName: true } },
        customer: { select: { name: true } },
      },
    });

    await this.notifications.create({
      userId: existing.customerId,
      type: 'system',
      title:
        dto.status === 'accepted'
          ? 'Custom order accepted'
          : 'Custom order declined',
      body:
        dto.status === 'accepted'
          ? 'Your custom order request was accepted by the artisan.'
          : 'Your custom order request was declined by the artisan.',
      link: '/marketplace/orders',
      idempotencyKey: `custom-order-${dto.status}:${id}`,
    });

    return this.toDto(row);
  }

  async listAdmin() {
    const rows = await this.prisma.customOrder.findMany({
      include: {
        artisan: { select: { brandName: true, businessName: true } },
        customer: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((r) => this.toDto(r));
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

    const html = `<p>${body}</p>`;
    try {
      await this.email.send({
        to: profile.user.email,
        subject: title,
        html,
        text: body,
      });
    } catch {
      // email is best-effort
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
