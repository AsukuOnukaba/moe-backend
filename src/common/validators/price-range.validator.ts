import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  Validate,
} from 'class-validator';

@ValidatorConstraint({ name: 'priceRange', async: false })
export class PriceRangeConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const obj = args.object as {
      priceMin?: number;
      priceMax?: number;
      price?: number;
      originalPrice?: number | null;
      minPrice?: number;
      maxPrice?: number;
    };
    const min = obj.priceMin ?? obj.minPrice ?? obj.price;
    const max = obj.priceMax ?? obj.maxPrice ?? obj.originalPrice;
    if (min === undefined || min === null || max === undefined || max === null) {
      return true;
    }
    return Number(max) >= Number(min);
  }

  defaultMessage(): string {
    return 'Maximum price must be greater than or equal to minimum price';
  }
}

export function ValidatePriceRange() {
  return Validate(PriceRangeConstraint);
}
