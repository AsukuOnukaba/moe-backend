declare class EnvVars {
    PORT?: number;
    NODE_ENV?: 'development' | 'test' | 'production';
    CORS_ORIGINS?: string;
}
export declare function validateEnv(config: Record<string, unknown>): EnvVars;
export {};
