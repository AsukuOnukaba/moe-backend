import type { AccessTokenPayload } from '../auth/types/jwt-payload';
type Notification = {
    id: number;
    userId: number;
    type: 'order_update' | 'message' | 'promotion' | 'system';
    title: string;
    body: string;
    read: boolean;
    link: string | null;
    createdAt: string;
};
export declare class NotificationsService {
    private getNotificationsForUser;
    list(user: AccessTokenPayload, query: any): Promise<{
        data: Notification[];
        pagination: {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        };
    }>;
    markRead(user: AccessTokenPayload, id: number): Promise<Notification | {
        message: string;
        code: string;
    }>;
    markAllRead(user: AccessTokenPayload): Promise<{
        success: boolean;
    }>;
}
export {};
