import { IsArray, IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class AuthRegisterDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsIn(['customer', 'artisan'])
  role?: 'customer' | 'artisan';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceCategories?: string[];
}

