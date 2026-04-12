import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsNotEmpty,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsNumber()
  priceMin: number;

  @IsNumber()
  priceMax: number;

  @IsOptional()
  @IsString()
  currency?: string = 'NGN';

  @IsOptional()
  @IsString()
  materials?: string;

  @IsOptional()
  @IsNumber()
  estimatedDeliveryDays?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
