import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCustomOrderDto {
  @IsInt()
  @Min(1)
  artisanId!: number;

  @IsString()
  @MinLength(50, {
    message: 'Description must be at least 50 characters',
  })
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
