import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class VariationOptionInputDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsString()
  @IsNotEmpty()
  value!: string;

  @IsOptional()
  @IsString()
  colorHex?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber()
  @Min(0)
  priceOverride?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(0)
  stockCount?: number | null;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

export class VariationTypeInputDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @IsNotEmpty()
  typeName!: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariationOptionInputDto)
  options!: VariationOptionInputDto[];
}

export class ReplaceProductVariationsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariationTypeInputDto)
  variationTypes!: VariationTypeInputDto[];
}

export class ToggleVariationTypeDto {
  @IsBoolean()
  isEnabled!: boolean;
}

export class UpdateVariationOptionStockDto {
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  stockCount!: number | null;
}
