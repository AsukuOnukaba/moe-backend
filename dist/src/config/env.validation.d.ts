declare class EnvVars {
    PORT?: number;
    NODE_ENV?: 'development' | 'test' | 'production';
    CORS_ORIGINS?: string;
    DATABASE_URL: string;
    JWT_ACCESS_SECRET: string;
    JWT_REFRESH_SECRET: string;
    JWT_ACCESS_EXPIRES_IN?: string;
    JWT_REFRESH_EXPIRES_IN?: string;
}
export declare function validateEnv(config: Record<string, unknown>): EnvVars;
export {};
