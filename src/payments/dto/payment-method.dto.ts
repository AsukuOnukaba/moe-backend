export class PaymentMethodDto {
  id!: string;
  brand!: string;
  last4!: string;
  expiry!: string;
  cardholderName!: string;
  billingAddressId?: number | null;
  isDefault!: boolean;
  createdAt!: Date;
}
