import { IsEmail, IsString, MinLength } from 'class-validator';

export class CorrectSignupEmailDto {
  /** Current (possibly mistyped) signup address. */
  @IsEmail()
  email!: string;

  /** Confirms ownership of the unverified account. */
  @IsString()
  @MinLength(8)
  password!: string;

  /** Corrected address that will receive a new verification link. */
  @IsEmail()
  newEmail!: string;
}
