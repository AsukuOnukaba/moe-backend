import type { Request } from 'express';
import { PreferencesService } from './preferences.service';
export declare class PreferencesController {
    private readonly prefs;
    constructor(prefs: PreferencesService);
    get(req: Request): Promise<{
        id: number;
        userId: number;
        categories: string[];
        styleTags: string[];
        budget: number;
        updatedAt: string;
    } | null>;
    upsert(req: Request, body: any): Promise<{
        id: number;
        userId: number;
        categories: string[];
        styleTags: string[];
        budget: number;
        updatedAt: string;
    }>;
    clear(req: Request): Promise<{
        success: boolean;
    }>;
}
