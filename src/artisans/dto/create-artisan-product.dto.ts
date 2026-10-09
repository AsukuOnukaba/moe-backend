import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PRODUCT_CATEGORIES } from '../../common/product-categories';
import { ValidatePriceRange } from '../../common/validators/price-range.validator';

export class CreateArtisanProductDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(100, { message: 'Minimum price must be at least ₦100' })
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(100, { message: 'Minimum price must be at least ₦100' })
  priceMin?: number;

  @IsOptional()
  @IsNumber()
  @Max(10_000_000, {
    message: 'Maximum price cannot exceed ₦10,000,000',
  })
  @ValidatePriceRange()
  priceMax?: number;

  @IsOptional()
  @IsNumber()
  @Max(10_000_000, {
    message: 'Maximum price cannot exceed ₦10,000,000',
  })
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

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  estimatedDelivery!: string;

  @IsOptional()
  @IsInt()
  estimatedDeliveryDays?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  metaTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  metaDescription?: string | null;

  /** Null = stock not tracked. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(0)
  stockCount?: number | null;
}
