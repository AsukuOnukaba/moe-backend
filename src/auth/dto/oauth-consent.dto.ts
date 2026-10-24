import { Equals, IsBoolean } from 'class-validator';

export class OAuthConsentDto {
  @IsBoolean()
  @Equals(true, {
    message: 'You must agree to the Terms of Service and Privacy Policy',
  })
  acceptedTerms!: boolean;
}
