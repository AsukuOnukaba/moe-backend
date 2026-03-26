import { IsString, MinLength } from 'class-validator';

export class AuthRefreshDto {
  @IsString()
  @MinLength(1)
  refreshToken!: string;
}

