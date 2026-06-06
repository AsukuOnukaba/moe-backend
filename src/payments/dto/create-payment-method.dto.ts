import { IsNumber, IsOptional, IsString, Matches } from 'class-validator';

export class CreatePaymentMethodDto {
  @IsString()
  brand!: string; // e.g., VISA, MASTERCARD, AMEX

  @IsString()
  @Matches(/^\d{4}$/, { message: 'last4 must be exactly 4 digits' })
  last4!: string; // Last 4 digits only

  @IsString()
  @Matches(/^\d{2}\/(\d{2}|\d{4})$/, { message: 'expiry must be in MM/YY or MM/YYYY format' })
  expiry!: string; // MM/YY or MM/YYYY format

  @IsString()
  cardholderName!: string;

  @IsOptional()
  @IsNumber()
  billingAddressId?: number;

  @IsOptional()
  @IsString()
  processorToken?: string;
}
