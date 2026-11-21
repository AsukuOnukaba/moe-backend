import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsInt, ValidateNested } from 'class-validator';
import { UpdateProductAudienceDto } from './update-product-audience.dto';

class ProductAudienceApprovalDto extends UpdateProductAudienceDto {
  @IsInt()
  id!: number;
}

export class BulkUpdateProductAudienceDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ProductAudienceApprovalDto)
  items!: ProductAudienceApprovalDto[];
}
