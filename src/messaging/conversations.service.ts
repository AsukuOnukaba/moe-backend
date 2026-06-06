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
    messages: { senderType: string; readAt: Date | null }[],
    viewerRole: 'customer' | 'artisan',
  ) {
    const unreadSenderType = viewerRole === 'customer' ? 'provider' : 'customer';
    return messages.filter(
      (m) => m.senderType === unreadSenderType && m.readAt === null,
    ).length;
  }

  private toConversationDto(
    row: {
      id: number;
      customerId: number;
      providerId: number;
      lastMessage: string | null;
      lastMessageTime: Date | null;
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
      customerName: row.customer.name ?? '',
      providerName,
      lastMessage: row.lastMessage ?? '',
      lastMessageTime: (row.lastMessageTime ?? new Date()).toISOString(),
      unreadCount,
    };
  }

  private toMessageDto(message: {
    id: number;
    conversationId: number;
    senderId: number;
    senderType: string;
    content: string;
    sentAt: Date;
    readAt: Date | null;
  }) {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderType: message.senderType,
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
    const row = await this.getConversationForUser(user, conversationId);

    const content = typeof body?.content === 'string' ? body.content.trim() : '';
    if (!content) {
      return { message: 'Missing content', code: 'VALIDATION_ERROR' };
    }

    const senderType =
      row.customerId === user.sub ? 'customer' : 'provider';

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: user.sub,
        senderType,
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

    const now = new Date();
    await this.prisma.message.updateMany({
      where: {
        conversationId,
        senderType: unreadSenderType,
        readAt: null,
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
}
