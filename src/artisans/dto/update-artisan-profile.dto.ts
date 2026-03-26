import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateArtisanProfileDto {
  @IsOptional()
  @IsString()
  brandName?: string;

  @IsOptional()
  @IsString()
  about?: string | null;

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
}

