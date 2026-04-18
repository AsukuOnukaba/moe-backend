import { IsArray, IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateArtisanProfileDto {
  @IsOptional()
  @IsString()
  brandName?: string;

  @IsOptional()
  @IsString()
  businessName?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  about?: string | null;

  @IsOptional()
  @IsString()
  country?: string | null;

  @IsOptional()
  @IsString()
  address?: string | null;

  @IsOptional()
  @IsString()
  city?: string | null;

  @IsOptional()
  @IsString()
  state?: string | null;

  @IsOptional()
  @IsString()
  category?: string | null;

  @IsOptional()
  @IsString()
  styleTags?: string | null;

  @IsOptional()
  @IsString()
  serviceCategories?: string | null;

  @IsOptional()
  @IsString()
  heroImage?: string | null;

  @IsOptional()
  @IsString()
  storeImageUrl?: string | null;

  @IsOptional()
  @IsString()
  coverImageUrl?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[] | null;

  @IsOptional()
  @IsBoolean()
  customOrdersEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsNumber()
  estimatedDeliveryDays?: number;

  @IsOptional()
  @IsString()
  paymentSchedule?: string | null;

  @IsOptional()
  @IsNumber()
  depositPercentage?: number | null;

  @IsOptional()
  @IsString()
  refundPolicy?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  acceptedPaymentMethods?: string[];

  @IsOptional()
  @IsBoolean()
  installmentsAvailable?: boolean;

  @IsOptional()
  @IsString()
  installmentDetails?: string | null;
}

