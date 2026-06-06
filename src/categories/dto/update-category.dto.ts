import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  label?: string;

  @IsOptional()
  @IsString()
  icon?: string | null;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  sortOrder?: number;

  /** Rejected when category has products; not persisted. */
  @IsOptional()
  @IsString()
  slug?: string;
}
