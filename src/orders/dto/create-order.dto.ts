import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum CheckoutPaymentMethod {
  CARD = 'card',
  WALLET = 'wallet',
  BANK_TRANSFER = 'bank_transfer',
  COD = 'cod',
}

export class CheckoutShippingAddressDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  lastName!: string;

  @IsString()
  @Matches(/^\+?[0-9\s\-()]{7,20}$/, {
    message: 'phone must be a valid phone number',
  })
  phone!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  address!: string;

  @IsString()
  @MinLength(1)
  country!: string;

  @IsString()
  @MinLength(1)
  state!: string;

  @IsString()
  @MinLength(1)
  city!: string;

  /** Legacy / extended fields accepted when present */
  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;
}

export class CheckoutOrderItemDto {
  @IsString()
  productId!: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  quantity?: number;

  @IsOptional()
  @IsObject()
  customisation?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  customization?: Record<string, unknown>;

  @IsOptional()
  @Type(() => Number)
  basePrice?: number;

  @IsOptional()
  @Type(() => Number)
  finalPrice?: number;

  @IsOptional()
  @IsBoolean()
  rushOrder?: boolean;
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutOrderItemDto)
  items!: CheckoutOrderItemDto[];

  @ValidateNested()
  @Type(() => CheckoutShippingAddressDto)
  shippingAddress!: CheckoutShippingAddressDto;

  @IsEnum(CheckoutPaymentMethod)
  paymentMethod!: CheckoutPaymentMethod;

  @ValidateIf((o) => o.paymentMethod === CheckoutPaymentMethod.CARD)
  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @ValidateIf(
    (o) =>
      o.paymentMethod === CheckoutPaymentMethod.CARD && !o.paymentMethodId,
  )
  @IsString()
  @MinLength(1)
  gatewayToken?: string;

  @IsOptional()
  @IsBoolean()
  saveCard?: boolean;

  @ValidateIf((o) => o.saveCard === true && !o.paymentMethodId)
  @IsString()
  @MinLength(1)
  cardBrand?: string;

  @ValidateIf((o) => o.saveCard === true && !o.paymentMethodId)
  @IsString()
  @Matches(/^\d{4}$/)
  cardLast4?: string;

  @ValidateIf((o) => o.saveCard === true && !o.paymentMethodId)
  @IsString()
  @Matches(/^\d{2}\/(\d{2}|\d{4})$/)
  cardExpiry?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsBoolean()
  rushOrder?: boolean;
}
