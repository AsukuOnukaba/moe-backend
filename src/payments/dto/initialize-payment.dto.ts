import { IsBoolean, IsIn, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class InitializePaymentDto {
  @IsString()
  orderId!: string;

  @IsIn(['paystack', 'flutterwave'])
  gateway!: 'paystack' | 'flutterwave';

  @IsOptional()
  @IsBoolean()
  saveCard?: boolean;

  /** Hosted checkout limited to cards. Ignored amounts are never used. */
  @IsOptional()
  @IsBoolean()
  cardOnly?: boolean;

  /** Accepted so older clients do not fail validation. Never used as the charge. */
  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  callbackUrl?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
