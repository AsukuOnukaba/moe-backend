import { Type } from 'class-transformer';
import { IsArray, IsIn, ValidateNested } from 'class-validator';
import { ProductSizeProfileInputDto } from '../../artisans/dto/product-sizing.dto';
import { PRODUCT_AUDIENCES } from '../../products/product-audience';

export class UpdateProductSizingDto {
  @IsArray()
  @IsIn([...PRODUCT_AUDIENCES], { each: true })
  designedFor!: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductSizeProfileInputDto)
  sizeProfiles!: ProductSizeProfileInputDto[];
}
