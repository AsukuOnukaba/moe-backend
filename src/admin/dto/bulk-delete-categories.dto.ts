import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class BulkDeleteCategoriesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];
}
