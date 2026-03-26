import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class ArtisanProfilePatchDto {
  @IsOptional()
  @IsString()
  brandName?: string;

  @IsOptional()
  @IsString()
  about?: string | null;

  @IsOptional()
  @IsString()
  city?: string | null;

  @IsOptional()
  @IsString()
  state?: string | null;

  @IsOptional()
  @IsString()
  category?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  styleTags?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceCategories?: string[];
}

export class AuthProfilePatchDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => ArtisanProfilePatchDto)
  artisanProfile?: ArtisanProfilePatchDto;
}

