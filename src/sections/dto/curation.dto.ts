import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CuratedItemInputDto {
  @IsIn(['product', 'artisan'])
  itemType!: 'product' | 'artisan';

  @IsString()
  itemId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;
}

export class ReplaceSectionItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CuratedItemInputDto)
  items!: CuratedItemInputDto[];
}

export class ReorderSectionItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items!: ReorderItemDto[];
}

export class ReorderItemDto {
  @IsString()
  itemId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  position!: number;
}

export class SeasonalKeywordsDto {
  @IsArray()
  @IsString({ each: true })
  keywords!: string[];
}
