"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreferencesService = void 0;
const common_1 = require("@nestjs/common");
const prefStore = new Map();
let prefIdSeq = 1;
let PreferencesService = class PreferencesService {
    async get(user) {
        return prefStore.get(user.sub) ?? null;
    }
    async upsert(user, body) {
        const existing = prefStore.get(user.sub);
        const next = {
            id: existing?.id ?? prefIdSeq++,
            userId: user.sub,
            categories: Array.isArray(body?.categories) ? body.categories : existing?.categories ?? [],
            styleTags: Array.isArray(body?.styleTags) ? body.styleTags : existing?.styleTags ?? [],
            budget: typeof body?.budget === 'number' ? body.budget : existing?.budget ?? 0,
            updatedAt: new Date().toISOString(),
        };
        prefStore.set(user.sub, next);
        return next;
    }
    async clear(user) {
        prefStore.delete(user.sub);
        return { success: true };
    }
};
exports.PreferencesService = PreferencesService;
exports.PreferencesService = PreferencesService = __decorate([
    (0, common_1.Injectable)()
], PreferencesService);
//# sourceMappingURL=preferences.service.js.map