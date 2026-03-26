export type MoeRole = 'customer' | 'provider' | 'admin';

export type AccessTokenPayload = {
  sub: number;
  email: string;
  role: MoeRole;
};

export type RefreshTokenPayload = {
  sub: number;
  jti: string;
};

