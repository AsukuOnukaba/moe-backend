import type { AccessTokenPayload } from '../auth/types/jwt-payload';
type UserPreference = {
    id: number;
    userId: number;
    categories: string[];
    styleTags: string[];
    budget: number;
    updatedAt: string;
};
export declare class PreferencesService {
    get(user: AccessTokenPayload): Promise<UserPreference | null>;
    upsert(user: AccessTokenPayload, body: any): Promise<UserPreference>;
    clear(user: AccessTokenPayload): Promise<{
        success: boolean;
    }>;
}
export {};
