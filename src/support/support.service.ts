import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

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
}
