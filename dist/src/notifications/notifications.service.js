"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const notificationStore = new Map();
let notificationIdSeq = 1;
let NotificationsService = class NotificationsService {
    getNotificationsForUser(userId) {
        const existing = notificationStore.get(userId);
        if (existing)
            return existing;
        const created = [];
        notificationStore.set(userId, created);
        return created;
    }
    async list(user, query) {
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
    async markRead(user, id) {
        const all = this.getNotificationsForUser(user.sub);
        const idx = all.findIndex((n) => n.id === id);
        if (idx < 0)
            return { message: 'Not found', code: 'RESOURCE_NOT_FOUND' };
        all[idx] = { ...all[idx], read: true };
        return all[idx];
    }
    async markAllRead(user) {
        const all = this.getNotificationsForUser(user.sub);
        for (let i = 0; i < all.length; i++)
            all[i] = { ...all[i], read: true };
        return { success: true };
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)()
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map