import { IsString, MinLength } from 'class-validator';

export class AuthClerkVerifyDto {
  /** Clerk session token (JWT) obtained client-side via `getToken()`. */
  @IsString()
  @MinLength(20)
  token!: string;
}
