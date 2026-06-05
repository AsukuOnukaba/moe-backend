import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PRODUCT_CATEGORIES } from '../../common/product-categories';

export class CreateArtisanProductDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceMax?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  originalPrice?: number | null;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[] | null;

  @IsOptional()
  @IsString()
  @IsIn([...PRODUCT_CATEGORIES], {
    message: `category must be one of: ${PRODUCT_CATEGORIES.join(', ')}`,
  })
  category?: string | null;

  // Comma-separated strings (backend stores as text)
  @IsOptional()
  @IsString()
  materials?: string | null;

  @IsOptional()
  @IsString()
  tags?: string | null;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsBoolean()
  isBestSeller?: boolean;

  @IsOptional()
  @IsBoolean()
  isTrending?: boolean;

  @IsOptional()
  @IsBoolean()
  isNewArrival?: boolean;

  @IsOptional()
  @IsNumber()
  discountPercent?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  estimatedDelivery?: string | null;

  @IsOptional()
  @IsInt()
  estimatedDeliveryDays?: number;
}
