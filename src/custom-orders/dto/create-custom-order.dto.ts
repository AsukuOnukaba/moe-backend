import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCustomOrderDto {
  @IsInt()
  @Min(1)
  artisanId!: number;

  /** Required field; short descriptions allowed (0 was rejected by required rule via MinLength 1). Max 200. */
  @IsString()
  @MinLength(1, { message: 'Description is required' })
  @MaxLength(200, { message: 'Description must be at most 200 characters' })
  description!: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  referenceImages?: string[];

  @IsNumber()
  @IsOptional()
  @Min(0)
  budgetMin?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  budgetMax?: number;

  /** @deprecated Prefer budgetMin/budgetMax */
  @IsNumber()
  @IsOptional()
  @Min(0)
  budget?: number;

  @IsDateString()
  @IsOptional()
  deadline?: string;

  @IsString()
  @IsOptional()
  specialInstructions?: string;

  @IsObject()
  @IsOptional()
  categoryFields?: Record<string, unknown>;
}
