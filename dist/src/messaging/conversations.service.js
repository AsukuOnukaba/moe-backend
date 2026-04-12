"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../database/prisma.service");
const conversationStore = new Map();
let conversationIdSeq = 1;
let messageIdSeq = 1;
let ConversationsService = class ConversationsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    computeUnreadForCustomer(conv, messages) {
        return messages.filter((m) => m.senderType === 'provider' && m.readAt === null).length;
    }
    async list(customer) {
        const userId = customer.sub;
        const items = [];
        for (const entry of conversationStore.values()) {
            if (entry.conversation.customerId !== userId)
                continue;
            items.push(entry.conversation);
        }
        return items;
    }
    async start(customer, body) {
        const customerId = customer.sub;
        const providerId = Number(body?.providerId ?? 0);
        const initialMessage = typeof body?.initialMessage === 'string' ? body.initialMessage : '';
        if (!providerId)
            return { message: 'Missing providerId', code: 'VALIDATION_ERROR' };
        const providerUser = await this.prisma.user.findUnique({
            where: { id: providerId },
            include: { artisanProfile: true },
        });
        const providerName = providerUser?.artisanProfile?.brandName ?? providerUser?.name ?? '';
        for (const entry of conversationStore.values()) {
            if (entry.conversation.customerId === customerId && entry.conversation.providerId === providerId) {
                const now = new Date().toISOString();
                const message = {
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
        const conversation = {
            id: conversationIdSeq++,
            customerId,
            providerId,
            providerName,
            lastMessage: initialMessage,
            lastMessageTime: now,
            unreadCount: 1,
        };
        const message = {
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
    async listMessages(customer, conversationId) {
        const entry = conversationStore.get(conversationId);
        if (!entry)
            throw new common_1.NotFoundException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });
        if (entry.conversation.customerId !== customer.sub)
            throw new common_1.NotFoundException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });
        return entry.messages;
    }
    async sendMessage(customer, conversationId, body) {
        const entry = conversationStore.get(conversationId);
        if (!entry)
            throw new common_1.NotFoundException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });
        const content = typeof body?.content === 'string' ? body.content : '';
        if (!content)
            return { message: 'Missing content', code: 'VALIDATION_ERROR' };
        const now = new Date().toISOString();
        const senderType = entry.conversation.customerId === customer.sub ? 'customer' : 'provider';
        const message = {
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
    async markRead(customer, conversationId) {
        const entry = conversationStore.get(conversationId);
        if (!entry)
            throw new common_1.NotFoundException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });
        if (entry.conversation.customerId !== customer.sub)
            throw new common_1.NotFoundException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });
        const now = new Date().toISOString();
        for (const m of entry.messages) {
            if (m.senderType === 'provider' && m.readAt === null)
                m.readAt = now;
        }
        entry.conversation.unreadCount = 0;
        entry.conversation.lastMessageTime = now;
        return { success: true };
    }
};
exports.ConversationsService = ConversationsService;
exports.ConversationsService = ConversationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ConversationsService);
//# sourceMappingURL=conversations.service.js.map