import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
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
  @IsNotEmpty()
  @MinLength(30)
  description!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(3)
  referenceImages?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  budget?: number;

  @IsOptional()
  @IsString()
  deadline?: string;
}
