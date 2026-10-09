import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsNotEmpty,
  Min,
  Max,
} from 'class-validator';
import { ValidatePriceRange } from '../../common/validators/price-range.validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsNumber()
  @Min(100, { message: 'Minimum price must be at least ₦100' })
  priceMin: number;

  @IsNumber()
  @Max(10_000_000, {
    message: 'Maximum price cannot exceed ₦10,000,000',
  })
  @ValidatePriceRange()
  priceMax: number;

  @IsString()
  @IsNotEmpty()
  estimatedDelivery: string;

  @IsOptional()
  @IsString()
  currency?: string = 'NGN';

  @IsOptional()
  @IsString()
  materials?: string;

  @IsOptional()
  @IsNumber()
  estimatedDeliveryDays?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
