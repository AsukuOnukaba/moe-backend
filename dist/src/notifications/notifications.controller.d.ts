import type { Request } from 'express';
import { NotificationsService } from './notifications.service';
export declare class NotificationsController {
    private readonly notifications;
    constructor(notifications: NotificationsService);
    list(req: Request, query: any): Promise<{
        data: {
            id: number;
            userId: number;
            type: "order_update" | "message" | "promotion" | "system";
            title: string;
            body: string;
            read: boolean;
            link: string | null;
            createdAt: string;
        }[];
        pagination: {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        };
    }>;
    markOne(req: Request, id: string, _body: any): Promise<{
        id: number;
        userId: number;
        type: "order_update" | "message" | "promotion" | "system";
        title: string;
        body: string;
        read: boolean;
        link: string | null;
        createdAt: string;
    } | {
        message: string;
        code: string;
    }>;
    markAll(req: Request): Promise<{
        success: boolean;
    }>;
}
