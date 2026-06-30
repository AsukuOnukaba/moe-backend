import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  private computeUnreadCount(
    messages: { senderRole: string; senderType: string; readAt: Date | null }[],
    viewerRole: 'customer' | 'artisan' | 'admin',
  ) {
    return messages.filter((m) => {
      if (m.readAt !== null) return false;
      if (viewerRole === 'customer') {
        return m.senderRole === 'admin' || m.senderType === 'provider';
      }
      if (viewerRole === 'artisan' || viewerRole === 'admin') {
        return m.senderRole === 'customer' || m.senderType === 'customer';
      }
      return false;
    }).length;
  }

  private toConversationDto(
    row: {
      id: number;
      customerId: number;
      providerId: number;
      lastMessage: string | null;
      lastMessageTime: Date | null;
      artisanNote?: string | null;
      status?: string;
      customer: { name: string };
      provider: { brandName: string | null; user: { name: string } };
    },
    unreadCount: number,
  ) {
    const providerName =
      row.provider.brandName ?? row.provider.user.name ?? '';
    return {
      id: row.id,
      customerId: row.customerId,
      providerId: row.providerId,
      artisanId: row.providerId,
      customerName: row.customer.name ?? '',
      providerName,
      artisanName: providerName,
      lastMessage: row.lastMessage ?? '',
      lastMessageTime: (row.lastMessageTime ?? new Date()).toISOString(),
      lastMessageAt: (row.lastMessageTime ?? new Date()).toISOString(),
      status: row.status ?? 'unread',
      artisanNote: row.artisanNote ?? null,
      unreadCount,
    };
  }

  private toMessageDto(message: {
    id: number;
    conversationId: number;
    senderId: number;
    senderType: string;
    senderRole: string;
    content: string;
    sentAt: Date;
    readAt: Date | null;
  }) {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderType: message.senderType,
      senderRole: message.senderRole,
      content: message.content,
      sentAt: message.sentAt.toISOString(),
      readAt: message.readAt?.toISOString() ?? null,
    };
  }

  private conversationInclude() {
    return {
      customer: { select: { name: true } },
      provider: {
        include: { user: { select: { name: true } } },
      },
      messages: { orderBy: { sentAt: 'asc' as const } },
    };
  }

  private async emitMessageNotification(
    conversation: {
      id: number;
      customerId: number;
      providerId: number;
      customer: { name: string };
      provider: { brandName: string | null; user: { name: string } };
    },
    message: { id: number; senderType: string; content: string },
  ) {
    const isCustomerSender = message.senderType === 'customer';
    const recipientId = isCustomerSender
      ? conversation.providerId
      : conversation.customerId;
    const senderName = isCustomerSender
      ? conversation.customer.name
      : (conversation.provider.brandName ??
        conversation.provider.user.name ??
        '');

    await this.notifications.notifyNewMessage({
      recipientId,
      senderName,
      content: message.content,
      conversationId: conversation.id,
      messageId: message.id,
    });
  }

  async list(user: AccessTokenPayload) {
    if (user.role === 'artisan') {
      return this.listForArtisan(user);
    }
    if (user.role !== 'customer') {
      throw new ForbiddenException({
        message: 'Forbidden',
        code: 'FORBIDDEN',
      });
    }
    return this.listForCustomer(user);
  }

  private async listForCustomer(customer: AccessTokenPayload) {
    const rows = await this.prisma.conversation.findMany({
      where: { customerId: customer.sub },
      include: this.conversationInclude(),
      orderBy: { lastMessageTime: 'desc' },
    });

    return rows.map((row) =>
      this.toConversationDto(
        row,
        this.computeUnreadCount(row.messages, 'customer'),
      ),
    );
  }

  private async listForArtisan(artisan: AccessTokenPayload) {
    const rows = await this.prisma.conversation.findMany({
      where: { providerId: artisan.sub },
      include: this.conversationInclude(),
      orderBy: { lastMessageTime: 'desc' },
    });

    return rows.map((row) =>
      this.toConversationDto(
        row,
        this.computeUnreadCount(row.messages, 'artisan'),
      ),
    );
  }

  async start(customer: AccessTokenPayload, body: { providerId?: number; initialMessage?: string }) {
    const customerId = customer.sub;
    const providerId = Number(body?.providerId ?? 0);
    const initialMessage =
      typeof body?.initialMessage === 'string' ? body.initialMessage.trim() : '';
    if (!providerId) {
      return { message: 'Missing providerId', code: 'VALIDATION_ERROR' };
    }

    const provider = await this.prisma.artisanProfile.findUnique({
      where: { userId: providerId },
      include: { user: { select: { name: true } } },
    });
    if (!provider) {
      throw new NotFoundException({
        message: 'Not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    let conversation = await this.prisma.conversation.findUnique({
      where: { customerId_providerId: { customerId, providerId } },
      include: this.conversationInclude(),
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          customerId,
          providerId,
          lastMessage: initialMessage || null,
          lastMessageTime: initialMessage ? new Date() : null,
        },
        include: this.conversationInclude(),
      });
    }

    if (initialMessage) {
      const createdMessage = await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: customerId,
          senderType: 'customer',
          senderRole: 'customer',
          content: initialMessage,
        },
      });
      conversation = await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessage: initialMessage,
          lastMessageTime: new Date(),
        },
        include: this.conversationInclude(),
      });
      await this.emitMessageNotification(conversation, createdMessage);
    }

    return this.toConversationDto(
      conversation,
      this.computeUnreadCount(conversation.messages, 'customer'),
    );
  }

  private async getConversationForUser(
    user: AccessTokenPayload,
    conversationId: number,
  ) {
    const where =
      user.role === 'artisan'
        ? { id: conversationId, providerId: user.sub }
        : { id: conversationId, customerId: user.sub };

    const row = await this.prisma.conversation.findFirst({
      where,
      include: this.conversationInclude(),
    });
    if (!row) {
      throw new NotFoundException({
        message: 'Not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    return row;
  }

  async listMessages(user: AccessTokenPayload, conversationId: number) {
    const row = await this.getConversationForUser(user, conversationId);
    return row.messages.map((m) => this.toMessageDto(m));
  }

  async sendMessage(
    user: AccessTokenPayload,
    conversationId: number,
    body: { content?: string },
  ) {
    if (user.role === 'artisan') {
      throw new ForbiddenException({
        message: 'Artisans cannot send messages directly. Use a private note instead.',
        code: 'FORBIDDEN',
      });
    }

    const row = await this.getConversationForUser(user, conversationId);

    const content = typeof body?.content === 'string' ? body.content.trim() : '';
    if (!content) {
      return { message: 'Missing content', code: 'VALIDATION_ERROR' };
    }

    const senderType =
      row.customerId === user.sub ? 'customer' : 'provider';
    const senderRole = row.customerId === user.sub ? 'customer' : 'admin';

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: user.sub,
        senderType,
        senderRole,
        content,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessage: content, lastMessageTime: new Date() },
    });

    await this.emitMessageNotification(row, message);

    return this.toMessageDto(message);
  }

  async markRead(user: AccessTokenPayload, conversationId: number) {
    const row = await this.getConversationForUser(user, conversationId);

    const unreadSenderType =
      user.role === 'artisan' ? 'customer' : 'provider';
    const unreadSenderRole = user.role === 'customer' ? 'admin' : 'customer';

    const now = new Date();
    await this.prisma.message.updateMany({
      where: {
        conversationId,
        readAt: null,
        OR: [
          { senderRole: unreadSenderRole },
          { senderType: unreadSenderType },
        ],
      },
      data: { readAt: now },
    });

    await this.prisma.conversation.update({
      where: { id: row.id },
      data: { lastMessageTime: now },
    });

    return { success: true };
  }

  private participantWhere(user: AccessTokenPayload) {
    if (user.role === 'artisan') {
      return { providerId: user.sub };
    }
    if (user.role === 'customer') {
      return { customerId: user.sub };
    }
    return null;
  }

  private isParticipant(
    conversation: { customerId: number; providerId: number },
    user: AccessTokenPayload,
  ) {
    return (
      conversation.customerId === user.sub || conversation.providerId === user.sub
    );
  }

  private bulkDeleteAllowed() {
    const flag = this.config.get<string>('ALLOW_CONVERSATION_BULK_DELETE');
    const nodeEnv = this.config.get<string>('NODE_ENV') ?? 'development';
    return flag === 'true' || nodeEnv !== 'production';
  }

  async deleteOne(user: AccessTokenPayload, conversationId: number) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException({
        message: 'Not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    if (!this.isParticipant(conversation, user)) {
      throw new ForbiddenException({
        message: 'Forbidden',
        code: 'FORBIDDEN',
      });
    }

    await this.notifications.deleteMessageNotificationsForConversations([
      conversationId,
    ]);
    await this.prisma.conversation.delete({ where: { id: conversationId } });
  }

  async deleteAllForUser(user: AccessTokenPayload) {
    if (!this.bulkDeleteAllowed()) {
      throw new ForbiddenException({
        message: 'Bulk conversation delete is disabled',
        code: 'FORBIDDEN',
      });
    }

    const participantFilter = this.participantWhere(user);
    if (!participantFilter) {
      throw new ForbiddenException({
        message: 'Forbidden',
        code: 'FORBIDDEN',
      });
    }

    const conversations = await this.prisma.conversation.findMany({
      where: participantFilter,
      select: { id: true },
    });

    if (conversations.length === 0) {
      return { deleted: 0 };
    }

    const ids = conversations.map((c) => c.id);
    await this.notifications.deleteMessageNotificationsForConversations(ids);
    const result = await this.prisma.conversation.deleteMany({
      where: { id: { in: ids } },
    });

    return { deleted: result.count };
  }

  async listForAdmin(query: {
    page?: number;
    pageSize?: number;
    status?: string;
  }) {
    const page = Math.max(1, Number(query?.page ?? 1));
    const pageSize = Math.max(1, Math.min(100, Number(query?.pageSize ?? 20)));
    const skip = (page - 1) * pageSize;
    const statusFilter =
      typeof query?.status === 'string' && query.status.trim()
        ? query.status.trim()
        : undefined;

    const where = statusFilter ? { status: statusFilter } : {};

    const [totalItems, rows] = await Promise.all([
      this.prisma.conversation.count({ where }),
      this.prisma.conversation.findMany({
        where,
        include: this.conversationInclude(),
        orderBy: { lastMessageTime: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    return {
      data: rows.map((row) =>
        this.toConversationDto(
          row,
          this.computeUnreadCount(row.messages, 'admin'),
        ),
      ),
      pagination: {
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
        totalItems,
      },
    };
  }

  async adminReply(
    admin: AccessTokenPayload,
    conversationId: number,
    body: { content?: string },
  ) {
    const content = typeof body?.content === 'string' ? body.content.trim() : '';
    if (!content) {
      return { message: 'Missing content', code: 'VALIDATION_ERROR' };
    }

    const row = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: this.conversationInclude(),
    });
    if (!row) {
      throw new NotFoundException({
        message: 'Not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: admin.sub,
        senderType: 'provider',
        senderRole: 'admin',
        content,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessage: content,
        lastMessageTime: new Date(),
        status: 'replied',
      },
    });

    await this.notifications.notifyNewMessage({
      recipientId: row.customerId,
      senderName: 'MoE Support',
      content,
      conversationId: row.id,
      messageId: message.id,
    });

    return this.toMessageDto(message);
  }

  async updateStatus(
    conversationId: number,
    status: 'resolved' | 'needs_follow_up' | 'replied' | 'unread',
  ) {
    const row = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!row) {
      throw new NotFoundException({
        message: 'Not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status },
    });

    return { success: true, status };
  }

  async updateArtisanNote(
    artisan: AccessTokenPayload,
    conversationId: number,
    note: string,
  ) {
    const row = await this.prisma.conversation.findFirst({
      where: { id: conversationId, providerId: artisan.sub },
    });
    if (!row) {
      throw new NotFoundException({
        message: 'Not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { artisanNote: note.trim() || null },
    });

    return { success: true };
  }

  async getMessagesForAdmin(conversationId: number) {
    const row = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: this.conversationInclude(),
    });
    if (!row) {
      throw new NotFoundException({
        message: 'Not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    return {
      conversation: this.toConversationDto(
        row,
        this.computeUnreadCount(row.messages, 'admin'),
      ),
      messages: row.messages.map((m) => this.toMessageDto(m)),
    };
  }
}
