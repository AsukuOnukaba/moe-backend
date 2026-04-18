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
export declare class ConversationsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private computeUnreadForCustomer;
    list(customer: AccessTokenPayload): Promise<Conversation[]>;
    start(customer: AccessTokenPayload, body: any): Promise<Conversation | {
        message: string;
        code: string;
    }>;
    listMessages(customer: AccessTokenPayload, conversationId: number): Promise<Message[]>;
    sendMessage(customer: AccessTokenPayload, conversationId: number, body: any): Promise<Message | {
        message: string;
        code: string;
    }>;
    markRead(customer: AccessTokenPayload, conversationId: number): Promise<{
        success: boolean;
    }>;
}
export {};
