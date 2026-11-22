import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { PRODUCT_AUDIENCES } from '../../products/product-audience';

export class SizeMeasurementDefinitionDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsIn(['body', 'garment'])
  kind!: 'body' | 'garment';

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsString()
  guidance?: string;
}

export class ProductSizeOptionInputDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsObject()
  measurements!: Record<string, number | { min: number; max: number }>;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

export class ProductFitChoiceInputDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  illustrationUrl?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

export class ProductSizeProfileInputDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsIn([...PRODUCT_AUDIENCES])
  audience!: string;

  @IsString()
  @IsNotEmpty()
  productType!: string;

  @IsString()
  @IsNotEmpty()
  sizingSystem!: string;

  @IsIn(['cm', 'in'])
  unit!: 'cm' | 'in';

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SizeMeasurementDefinitionDto)
  measurementDefinitions!: SizeMeasurementDefinitionDto[];

  @IsOptional()
  @IsBoolean()
  isMadeToMeasure?: boolean;

  @IsOptional()
  @IsString()
  instructions?: string | null;

  @IsOptional()
  @IsUrl({ require_tld: false })
  illustrationUrl?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductSizeOptionInputDto)
  sizes!: ProductSizeOptionInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductFitChoiceInputDto)
  fitChoices?: ProductFitChoiceInputDto[];
}
