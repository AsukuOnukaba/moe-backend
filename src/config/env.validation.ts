import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  Max,
  Min,
  validateSync,
} from 'class-validator';

class EnvVars {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT?: number;

  @IsOptional()
  @IsIn(['development', 'test', 'production'])
  NODE_ENV?: 'development' | 'test' | 'production';

  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;

  @IsString()
  @MinLength(1)
  DATABASE_URL!: string;

  @IsString()
  @MinLength(10)
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @MinLength(10)
  JWT_REFRESH_SECRET!: string;

  @IsOptional()
  @IsString()
  JWT_ACCESS_EXPIRES_IN?: string;

  @IsOptional()
  @IsString()
  JWT_REFRESH_EXPIRES_IN?: string;

  @IsOptional()
  @IsString()
  BASE_URL?: string;

  @IsOptional()
  @IsString()
  GOOGLE_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  GOOGLE_CLIENT_SECRET?: string;

  @IsOptional()
  @IsString()
  GOOGLE_CALLBACK_URL?: string;

  @IsOptional()
  @IsString()
  GOOGLE_SUCCESS_REDIRECT?: string;

  @IsOptional()
  @IsString()
  ALLOW_CONVERSATION_BULK_DELETE?: string;

  /** Clerk secret key (sk_test_… / sk_live_…) — enables POST /auth/clerk-verify. */
  @IsOptional()
  @IsString()
  CLERK_SECRET_KEY?: string;

  /** Optional: restricts accepted session tokens to these origins (comma-separated). */
  @IsOptional()
  @IsString()
  CLERK_AUTHORIZED_PARTIES?: string;

  /** Cloudinary — required for image uploads (products, store, covers, avatars). */
  @IsOptional()
  @IsString()
  CLOUDINARY_CLOUD_NAME?: string;

  @IsOptional()
  @IsString()
  CLOUDINARY_API_KEY?: string;

  @IsOptional()
  @IsString()
  CLOUDINARY_API_SECRET?: string;

  @IsOptional()
  @IsString()
  RESEND_API_KEY?: string;

  /** Verified sender, e.g. MOE Africa <verify@moe-africa.com>. Server-side only. */
  @IsOptional()
  @IsString()
  RESEND_FROM_EMAIL?: string;

  /** Legacy alias for RESEND_FROM_EMAIL. */
  @IsOptional()
  @IsString()
  RESEND_FROM?: string;

  @IsOptional()
  @IsString()
  FRONTEND_URL?: string;

  /** test (default) or live. Live charges also require PAYMENT_LIVE_ENABLED=true. */
  @IsOptional()
  @IsIn(['test', 'live'])
  PAYMENT_MODE?: 'test' | 'live';

  /** Must be the string "true" before live secret keys can start a charge. */
  @IsOptional()
  @IsString()
  PAYMENT_LIVE_ENABLED?: string;

  /** Paystack secret key. Test keys start with sk_test_. Server-side only. */
  @IsOptional()
  @IsString()
  PAYSTACK_SECRET_KEY?: string;

  /** Flutterwave secret key. Test keys contain TEST. Server-side only. */
  @IsOptional()
  @IsString()
  FLUTTERWAVE_SECRET_KEY?: string;

  /** Flutterwave dashboard secret hash, sent back in the verif-hash header. */
  @IsOptional()
  @IsString()
  FLUTTERWAVE_WEBHOOK_HASH?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvVars, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, {
    skipMissingProperties: false,
  });
  if (errors.length > 0) {
    const messages = errors
      .map((e) => Object.values(e.constraints ?? {}).join(', '))
      .filter(Boolean)
      .join(' | ');
    throw new Error(`Invalid environment variables: ${messages}`);
  }
  return validated;
}
