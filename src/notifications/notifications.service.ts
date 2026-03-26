import { Injectable } from '@nestjs/common';
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

const notificationStore = new Map<number, Notification[]>();
let notificationIdSeq = 1;

@Injectable()
export class NotificationsService {
  private getNotificationsForUser(userId: number) {
    const existing = notificationStore.get(userId);
    if (existing) return existing;
    const created: Notification[] = [];
    notificationStore.set(userId, created);
    return created;
  }

  async list(user: AccessTokenPayload, query: any) {
    const page = Math.max(1, Number(query?.page ?? 1));
    const pageSize = Math.max(1, Math.min(100, Number(query?.pageSize ?? 20)));
    const skip = (page - 1) * pageSize;

    const all = this.getNotificationsForUser(user.sub).slice().sort((a, b) => b.id - a.id);
    const totalItems = all.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const items = all.slice(skip, skip + pageSize);

    return {
      data: items,
      pagination: { page, pageSize, totalPages, totalItems },
    };
  }

  async markRead(user: AccessTokenPayload, id: number) {
    const all = this.getNotificationsForUser(user.sub);
    const idx = all.findIndex((n) => n.id === id);
    if (idx < 0) return { message: 'Not found', code: 'RESOURCE_NOT_FOUND' };
    all[idx] = { ...all[idx], read: true };
    return all[idx];
  }

  async markAllRead(user: AccessTokenPayload) {
    const all = this.getNotificationsForUser(user.sub);
    for (let i = 0; i < all.length; i++) all[i] = { ...all[i], read: true };
    return { success: true };
  }
}

