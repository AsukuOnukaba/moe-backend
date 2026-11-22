import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PRODUCT_CATEGORIES } from '../../common/product-categories';
import { VariationTypeInputDto } from '../../artisans/dto/product-variation.dto';
import { PRODUCT_AUDIENCES } from '../../products/product-audience';
import { ProductSizeProfileInputDto } from '../../artisans/dto/product-sizing.dto';

export class CreateAdminProductDto {
  @IsInt()
  @Min(1)
  artisanId!: number;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @IsIn([...PRODUCT_CATEGORIES])
  category?: string;

  @IsOptional()
  @IsArray()
  @IsIn([...PRODUCT_AUDIENCES], { each: true })
  designedFor?: string[];

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
  @IsString()
  currency?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsString()
  materials?: string;

  @IsOptional()
  @IsString()
  tags?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  estimatedDelivery?: string;

  @IsOptional()
  @IsInt()
  estimatedDeliveryDays?: number;

  /** Same shape as artisan create — persisted via ProductVariationsService. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariationTypeInputDto)
  variationTypes?: VariationTypeInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductSizeProfileInputDto)
  sizeProfiles?: ProductSizeProfileInputDto[];
}
