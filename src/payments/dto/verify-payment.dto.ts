import { IsIn, IsString } from 'class-validator';

export class VerifyPaymentDto {
  @IsString()
  reference!: string;

  @IsIn(['paystack', 'flutterwave'])
  gateway!: 'paystack' | 'flutterwave';
}
