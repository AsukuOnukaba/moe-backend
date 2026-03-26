import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';

type Conversation = {
  id: number;
  customerId: number;
  providerId: number;
  providerName: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
};

type Message = {
  id: number;
  conversationId: number;
  senderId: number;
  senderType: 'customer' | 'provider';
  content: string;
  sentAt: string;
  readAt: string | null;
};

const conversationStore = new Map<number, { conversation: Conversation; messages: Message[] }>();
let conversationIdSeq = 1;
let messageIdSeq = 1;

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  private computeUnreadForCustomer(conv: Conversation, messages: Message[]) {
    // unread = provider messages not yet read by customer
    return messages.filter((m) => m.senderType === 'provider' && m.readAt === null).length;
  }

  async list(customer: AccessTokenPayload) {
    const userId = customer.sub;
    const items: Conversation[] = [];

    for (const entry of conversationStore.values()) {
      if (entry.conversation.customerId !== userId) continue;
      items.push(entry.conversation);
    }
    return items;
  }

  async start(customer: AccessTokenPayload, body: any) {
    const customerId = customer.sub;
    const providerId = Number(body?.providerId ?? 0);
    const initialMessage = typeof body?.initialMessage === 'string' ? body.initialMessage : '';
    if (!providerId) return { message: 'Missing providerId', code: 'VALIDATION_ERROR' };

    const providerUser = await this.prisma.user.findUnique({
      where: { id: providerId },
      include: { artisanProfile: true },
    });
    const providerName = providerUser?.artisanProfile?.brandName ?? providerUser?.name ?? '';

    // If conversation exists between customer and provider, return existing and append the message.
    for (const entry of conversationStore.values()) {
      if (entry.conversation.customerId === customerId && entry.conversation.providerId === providerId) {
        const now = new Date().toISOString();
        const message: Message = {
          id: messageIdSeq++,
          conversationId: entry.conversation.id,
          senderId: providerId,
          senderType: 'provider',
          content: initialMessage,
          sentAt: now,
          readAt: null,
        };
        entry.messages.push(message);
        entry.conversation.lastMessage = initialMessage;
        entry.conversation.lastMessageTime = now;
        entry.conversation.unreadCount = this.computeUnreadForCustomer(entry.conversation, entry.messages);
        return entry.conversation;
      }
    }

    const now = new Date().toISOString();
    const conversation: Conversation = {
      id: conversationIdSeq++,
      customerId,
      providerId,
      providerName,
      lastMessage: initialMessage,
      lastMessageTime: now,
      unreadCount: 1,
    };

    const message: Message = {
      id: messageIdSeq++,
      conversationId: conversation.id,
      senderId: providerId,
      senderType: 'provider',
      content: initialMessage,
      sentAt: now,
      readAt: null,
    };

    conversationStore.set(conversation.id, { conversation, messages: [message] });
    return conversation;
  }

  async listMessages(customer: AccessTokenPayload, conversationId: number) {
    const entry = conversationStore.get(conversationId);
    if (!entry) throw new NotFoundException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });
    if (entry.conversation.customerId !== customer.sub) throw new NotFoundException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });
    return entry.messages;
  }

  async sendMessage(customer: AccessTokenPayload, conversationId: number, body: any) {
    const entry = conversationStore.get(conversationId);
    if (!entry) throw new NotFoundException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });

    const content = typeof body?.content === 'string' ? body.content : '';
    if (!content) return { message: 'Missing content', code: 'VALIDATION_ERROR' };

    const now = new Date().toISOString();
    const senderType: 'customer' | 'provider' =
      entry.conversation.customerId === customer.sub ? 'customer' : 'provider';

    const message: Message = {
      id: messageIdSeq++,
      conversationId,
      senderId: customer.sub,
      senderType,
      content,
      sentAt: now,
      readAt: null,
    };

    entry.messages.push(message);
    entry.conversation.lastMessage = content;
    entry.conversation.lastMessageTime = now;
    entry.conversation.unreadCount = this.computeUnreadForCustomer(entry.conversation, entry.messages);

    return message;
  }

  async markRead(customer: AccessTokenPayload, conversationId: number) {
    const entry = conversationStore.get(conversationId);
    if (!entry) throw new NotFoundException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });
    if (entry.conversation.customerId !== customer.sub) throw new NotFoundException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });

    const now = new Date().toISOString();
    // Mark provider-sent messages as read
    for (const m of entry.messages) {
      if (m.senderType === 'provider' && m.readAt === null) m.readAt = now;
    }

    entry.conversation.unreadCount = 0;
    entry.conversation.lastMessageTime = now;
    return { success: true };
  }
}

