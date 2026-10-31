import { IsString, MaxLength, MinLength } from 'class-validator';

export class VerifyEmailDto {
  @IsString()
  @MinLength(32, { message: 'This verification link is invalid.' })
  @MaxLength(128, { message: 'This verification link is invalid.' })
  token!: string;
}
