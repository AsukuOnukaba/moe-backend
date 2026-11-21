import { IsArray, IsIn } from 'class-validator';
import { PRODUCT_AUDIENCES } from '../../products/product-audience';

export class UpdateProductAudienceDto {
  @IsArray()
  @IsIn([...PRODUCT_AUDIENCES], { each: true })
  designedFor!: string[];
}
