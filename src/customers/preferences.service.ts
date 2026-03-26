import { Injectable } from '@nestjs/common';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';

type UserPreference = {
  id: number;
  userId: number;
  categories: string[];
  styleTags: string[];
  budget: number;
  updatedAt: string;
};

const prefStore = new Map<number, UserPreference>();
let prefIdSeq = 1;

@Injectable()
export class PreferencesService {
  async get(user: AccessTokenPayload) {
    return prefStore.get(user.sub) ?? null;
  }

  async upsert(user: AccessTokenPayload, body: any) {
    const existing = prefStore.get(user.sub);
    const next: UserPreference = {
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

  async clear(user: AccessTokenPayload) {
    prefStore.delete(user.sub);
    return { success: true };
  }
}

