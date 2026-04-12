import type { Request } from 'express';
import { ConversationsService } from './conversations.service';
export declare class ConversationsController {
    private readonly conversations;
    constructor(conversations: ConversationsService);
    list(req: Request): Promise<{
        id: number;
        customerId: number;
        providerId: number;
        providerName: string;
        lastMessage: string;
        lastMessageTime: string;
        unreadCount: number;
    }[]>;
    start(req: Request, body: any): Promise<{
        id: number;
        customerId: number;
        providerId: number;
        providerName: string;
        lastMessage: string;
        lastMessageTime: string;
        unreadCount: number;
    } | {
        message: string;
        code: string;
    }>;
    listMessages(req: Request, id: string): Promise<{
        id: number;
        conversationId: number;
        senderId: number;
        senderType: "customer" | "provider";
        content: string;
        sentAt: string;
        readAt: string | null;
    }[]>;
    sendMessage(req: Request, id: string, body: any): Promise<{
        id: number;
        conversationId: number;
        senderId: number;
        senderType: "customer" | "provider";
        content: string;
        sentAt: string;
        readAt: string | null;
    } | {
        message: string;
        code: string;
    }>;
    markRead(req: Request, id: string): Promise<{
        success: boolean;
    }>;
}
