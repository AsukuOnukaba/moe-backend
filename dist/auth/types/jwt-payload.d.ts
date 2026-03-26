export type MoeRole = 'customer' | 'artisan' | 'admin';
export type AccessTokenPayload = {
    sub: number;
    email: string;
    role: MoeRole;
};
export type RefreshTokenPayload = {
    sub: number;
    jti: string;
};
