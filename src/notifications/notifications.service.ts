import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { PrismaService } from '../database/prisma.service';

export type NotificationType =
  | 'order_update'
  | 'message'
  | 'promotion'
  | 'system'
  | 'product_removed_by_admin';

export type CreateNotificationInput = {
  userId: number;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  idempotencyKey: string;
  /** Max plain-text body length (default 140). Message previews use 80. */
  bodyMaxLength?: number;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private truncatePlainText(text: string, maxLength: number) {
    const trimmed = text.replace(/\s+/g, ' ').trim();
    if (trimmed.length <= maxLength) return trimmed;
    return `${trimmed.slice(0, maxLength - 1)}…`;
  }

  private toDto(row: {
    id: number;
    userId: number;
    type: string;
    title: string;
    body: string;
    read: boolean;
    link: string | null;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      userId: row.userId,
      type: row.type,
      title: row.title,
      body: row.body,
      read: row.read,
      link: row.link,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async create(input: CreateNotificationInput) {
    const bodyMaxLength = input.bodyMaxLength ?? 140;
    const data = {
      userId: input.userId,
      type: input.type,
      title: input.title.trim(),
      body: this.truncatePlainText(input.body, bodyMaxLength),
      link: input.link ?? null,
      idempotencyKey: input.idempotencyKey,
    };

    try {
      const row = await this.prisma.notification.create({ data });
      return this.toDto(row);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.notification.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        return existing ? this.toDto(existing) : null;
      }
      throw error;
    }
  }

  async notifyOrderCreated(customerId: number, orderId: number) {
    return this.create({
      userId: customerId,
      type: 'order_update',
      title: 'Order placed',
      body: `Your order #${orderId} has been received.`,
      link: `/orders/${orderId}`,
      idempotencyKey: `order:${orderId}:created`,
    });
  }

  humanOrderStatus(status: string) {
    const normalized = status.trim().toLowerCase();
    const labels: Record<string, string> = {
      pending: 'pending',
      confirmed: 'confirmed',
      awaiting_payment: 'awaiting payment',
      in_progress: 'in production',
      in_production: 'in production',
      approved: 'approved',
      shipped: 'shipped',
      delivered: 'delivered',
      cancelled: 'cancelled',
      rejected: 'rejected',
      paid: 'paid',
      refunded: 'refunded',
    };
    return labels[normalized] ?? normalized.replace(/_/g, ' ');
  }

  async notifyOrderStatusChange(
    customerId: number,
    orderId: number,
    newStatus: string,
  ) {
    const humanStatus = this.humanOrderStatus(newStatus);
    return this.create({
      userId: customerId,
      type: 'order_update',
      title: `Order ${humanStatus}`,
      body: `Order #${orderId} is now ${humanStatus}.`,
      link: `/orders/${orderId}`,
      idempotencyKey: `order:${orderId}:status:${newStatus.trim().toLowerCase()}`,
    });
  }

  async notifyProductRemovedByAdmin(input: {
    artisanUserId: number;
    productId: number;
    productName: string;
    reason?: string;
  }) {
    const reasonSuffix = input.reason?.trim()
      ? ` Reason: ${input.reason.trim()}`
      : '';
    return this.create({
      userId: input.artisanUserId,
      type: 'product_removed_by_admin',
      title: 'Product removed',
      body: `"${input.productName}" was permanently removed by an administrator.${reasonSuffix}`,
      link: '/artisan/products',
      idempotencyKey: `product:${input.productId}:removed_by_admin`,
    });
  }

  async notifyNewMessage(input: {
    recipientId: number;
    senderName: string;
    content: string;
    conversationId: number;
    messageId: number;
  }) {
    const conversationId = Number(input.conversationId);
    const link =
      Number.isFinite(conversationId) && conversationId > 0
        ? `/marketplace/messages/${conversationId}`
        : '/marketplace/messages';

    return this.create({
      userId: input.recipientId,
      type: 'message',
      title: `New message from ${input.senderName}`,
      body: input.content,
      link,
      idempotencyKey: `message:${input.messageId}`,
      bodyMaxLength: 80,
    });
  }

  conversationMessageLink(conversationId: number) {
    return `/marketplace/messages/${conversationId}`;
  }

  async deleteMessageNotificationsForConversations(conversationIds: number[]) {
    if (conversationIds.length === 0) return 0;

    const links = conversationIds.map((id) => this.conversationMessageLink(id));
    const result = await this.prisma.notification.deleteMany({
      where: {
        type: 'message',
        link: { in: links },
      },
    });
    return result.count;
  }

  async list(user: AccessTokenPayload, query: Record<string, unknown>) {
    const page = Math.max(1, Number(query?.page ?? 1));
    const pageSize = Math.max(1, Math.min(100, Number(query?.pageSize ?? 20)));
    const skip = (page - 1) * pageSize;

    const unreadOnly =
      query?.unread === true ||
      query?.unread === 'true' ||
      query?.unread === '1';
    const where = {
      userId: user.sub,
      ...(unreadOnly ? { read: false } : {}),
    };
    const [totalItems, rows] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    return {
      data: rows.map((row) => this.toDto(row)),
      pagination: { page, pageSize, totalPages, totalItems },
    };
  }

  async markRead(user: AccessTokenPayload, id: number) {
    const row = await this.prisma.notification.findFirst({
      where: { id, userId: user.sub },
    });
    if (!row) {
      throw new NotFoundException({
        message: 'Not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    const updated = await this.prisma.notification.update({
      where: { id: row.id },
      data: { read: true },
    });
    return this.toDto(updated);
  }

  async markAllRead(user: AccessTokenPayload) {
    await this.prisma.notification.updateMany({
      where: { userId: user.sub, read: false },
      data: { read: true },
    });
    return { success: true };
  }
}
