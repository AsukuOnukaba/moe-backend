import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import {
  cloudinaryPublicId,
  cloudinaryResourceType,
  messageAttachmentKind,
} from '../upload/multer.config';
import { signedAuthenticatedUrl } from '../upload/cloudinary';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeSource(type: string | undefined): string {
    const raw = (type ?? 'contact').trim().toLowerCase();
    if (raw === 'contact') return 'contact_us';
    return raw;
  }

  async create(body: Record<string, unknown>, customerId: number | null) {
    const source = this.normalizeSource(
      typeof body?.type === 'string' ? body.type : undefined,
    );
    const subject =
      typeof body?.subject === 'string' ? body.subject.trim() : null;
    const message =
      typeof body?.message === 'string'
        ? body.message.trim()
        : typeof body?.description === 'string'
          ? body.description.trim()
          : '';
    const senderEmail =
      typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const senderName =
      typeof body?.name === 'string' && body.name.trim()
        ? body.name.trim()
        : typeof body?.senderName === 'string' && body.senderName.trim()
          ? body.senderName.trim()
          : 'Guest';

    const row = await this.prisma.contactMessage.create({
      data: {
        senderName,
        senderEmail: senderEmail || 'unknown@contact.local',
        message: message || '(no message)',
        subject,
        source,
      },
    });

    return {
      id: row.id,
      customerId,
      type: source === 'contact_us' ? 'contact' : source,
      orderId:
        typeof body?.orderId === 'string' ? body.orderId : null,
      subject: row.subject ?? '',
      description: row.message,
      email: row.senderEmail,
      status: 'open' as const,
      createdAt: row.createdAt.toISOString(),
      source: row.source,
    };
  }

  async list(customerId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: customerId },
      select: { email: true },
    });
    if (!user) return [];

    const rows = await this.prisma.contactMessage.findMany({
      where: { senderEmail: user.email.toLowerCase() },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return rows.map((row) => ({
        id: row.id,
        customerId,
        type:
          row.source === 'contact_us'
            ? ('contact' as const)
            : (row.source as 'order_issue' | 'report' | 'return_request'),
        subject: row.subject ?? '',
        description: row.message,
        email: row.senderEmail,
        status: row.isRead ? ('in_review' as const) : ('open' as const),
        createdAt: row.createdAt.toISOString(),
        source: row.source,
      }));
  }

  async listContactForAdmin(query: { page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(query?.page ?? 1));
    const pageSize = Math.max(1, Math.min(100, Number(query?.pageSize ?? 50)));
    const skip = (page - 1) * pageSize;

    const where = { source: 'contact_us' };
    const [totalItems, rows] = await Promise.all([
      this.prisma.contactMessage.count({ where }),
      this.prisma.contactMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        source: 'contact_us' as const,
        senderName: row.senderName,
        senderEmail: row.senderEmail,
        subject: row.subject,
        message: row.message,
        isRead: row.isRead,
        createdAt: row.createdAt.toISOString(),
      })),
      pagination: {
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
        totalItems,
      },
    };
  }

  async createOrderComplaint(
    user: AccessTokenPayload,
    body: {
      orderId?: string | number;
      category?: string;
      description?: string;
      durationMs?: string | number;
    },
    files: Express.Multer.File[] = [],
  ) {
    if (user.role !== 'artisan') {
      throw new ForbiddenException({ message: 'Forbidden', code: 'FORBIDDEN' });
    }
    const orderId = Number(body.orderId);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      throw new BadRequestException({
        message: 'A valid order reference is required',
        code: 'VALIDATION_ERROR',
      });
    }
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.providerId !== user.sub) {
      throw new ForbiddenException({ message: 'Forbidden', code: 'FORBIDDEN' });
    }
    const category = body.category?.trim();
    const description = body.description?.trim();
    if (!category || !description || description.length < 10) {
      throw new BadRequestException({
        message: 'Complaint category and a description of at least 10 characters are required',
        code: 'VALIDATION_ERROR',
      });
    }
    const submitter = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.sub },
      select: { name: true, email: true },
    });
    const durationMs = Number(body.durationMs);
    const ticket = await this.prisma.contactMessage.create({
      data: {
        senderName: submitter.name,
        senderEmail: submitter.email,
        message: description,
        subject: `Order #${orderId}: ${category}`,
        source: 'order_complaint',
        submittedById: user.sub,
        orderId,
        category,
        status: 'open',
        attachments: {
          create: files.map((file) => {
            const kind = messageAttachmentKind(file.mimetype);
            return {
              attachmentPublicId: cloudinaryPublicId(file),
              attachmentResourceType: cloudinaryResourceType(file, file.mimetype),
              attachmentName: file.originalname || 'supporting-file',
              attachmentMimeType: file.mimetype || 'application/octet-stream',
              attachmentBytes: file.size ?? null,
              attachmentKind: kind,
              durationMs:
                kind === 'voice' && Number.isFinite(durationMs)
                  ? Math.max(0, Math.round(durationMs))
                  : null,
            };
          }),
        },
        events: {
          create: {
            actorId: user.sub,
            status: 'open',
            note: 'Complaint submitted',
          },
        },
      },
      include: { attachments: true, events: true },
    });
    return this.toOrderComplaint(ticket);
  }

  async listOrderComplaints(user: AccessTokenPayload, orderId?: string) {
    if (user.role !== 'artisan') {
      throw new ForbiddenException({ message: 'Forbidden', code: 'FORBIDDEN' });
    }
    const parsedOrderId = orderId ? Number(orderId) : undefined;
    const rows = await this.prisma.contactMessage.findMany({
      where: {
        source: 'order_complaint',
        submittedById: user.sub,
        ...(Number.isInteger(parsedOrderId) ? { orderId: parsedOrderId } : {}),
      },
      include: {
        attachments: { orderBy: { createdAt: 'asc' } },
        events: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toOrderComplaint(row));
  }

  async getOrderComplaintAttachment(
    user: AccessTokenPayload,
    ticketId: number,
    attachmentId: number,
  ) {
    const attachment = await this.prisma.supportTicketAttachment.findFirst({
      where: { id: attachmentId, ticketId },
      include: { ticket: { include: { order: true } } },
    });
    if (!attachment) {
      throw new NotFoundException({ message: 'Attachment not found', code: 'RESOURCE_NOT_FOUND' });
    }
    const allowed =
      user.role === 'admin' ||
      attachment.ticket.submittedById === user.sub ||
      attachment.ticket.order?.providerId === user.sub;
    if (!allowed) {
      throw new ForbiddenException({ message: 'Forbidden', code: 'FORBIDDEN' });
    }
    return signedAuthenticatedUrl(
      attachment.attachmentPublicId,
      attachment.attachmentResourceType,
      120,
    );
  }

  async updateOrderComplaintStatus(
    admin: AccessTokenPayload,
    ticketId: number,
    body: { status?: string; note?: string },
  ) {
    const allowed = ['open', 'in_review', 'awaiting_artisan', 'resolved', 'closed'];
    const status = body.status?.trim();
    if (!status || !allowed.includes(status)) {
      throw new BadRequestException({ message: 'Invalid complaint status', code: 'VALIDATION_ERROR' });
    }
    const existing = await this.prisma.contactMessage.findFirst({
      where: { id: ticketId, source: 'order_complaint' },
    });
    if (!existing) {
      throw new NotFoundException({ message: 'Complaint not found', code: 'RESOURCE_NOT_FOUND' });
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.supportTicketEvent.create({
        data: { ticketId, actorId: admin.sub, status, note: body.note?.trim() || null },
      });
      const updated = await tx.contactMessage.update({
        where: { id: ticketId },
        data: { status, isRead: true },
        include: {
          attachments: { orderBy: { createdAt: 'asc' } },
          events: { orderBy: { createdAt: 'asc' } },
        },
      });
      return this.toOrderComplaint(updated);
    });
  }

  private toOrderComplaint(ticket: {
    id: number;
    orderId: number | null;
    category: string | null;
    subject: string | null;
    message: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    attachments: Array<{
      id: number;
      attachmentName: string;
      attachmentMimeType: string;
      attachmentBytes: number | null;
      attachmentKind: string;
      durationMs: number | null;
    }>;
    events: Array<{
      id: number;
      status: string;
      note: string | null;
      createdAt: Date;
    }>;
  }) {
    return {
      id: ticket.id,
      orderId: ticket.orderId,
      category: ticket.category,
      subject: ticket.subject,
      description: ticket.message,
      status: ticket.status,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      attachments: ticket.attachments.map((attachment) => ({
        id: attachment.id,
        name: attachment.attachmentName,
        mimeType: attachment.attachmentMimeType,
        bytes: attachment.attachmentBytes,
        kind: attachment.attachmentKind,
        durationMs: attachment.durationMs,
        url: `/support/tickets/order-complaints/${ticket.id}/attachments/${attachment.id}`,
      })),
      history: ticket.events.map((event) => ({
        id: event.id,
        status: event.status,
        note: event.note,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  }
}
