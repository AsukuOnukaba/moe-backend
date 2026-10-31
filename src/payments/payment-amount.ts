import { roundMajor, toMinorUnits } from '../common/money';

/** Matches the delivery line already shown on cart and checkout. */
export const CHECKOUT_DELIVERY_FEE_NGN = 2500;

export function chargeForOrder(order: {
  price: number | null;
  currency: string | null;
}): {
  currency: string;
  amountMajor: number;
  amountMinor: number;
  merchandiseMajor: number;
  deliveryMajor: number;
} {
  const currency = (order.currency || 'NGN').toUpperCase();
  const merchandiseMajor = roundMajor(Number(order.price ?? 0));
  if (!(merchandiseMajor > 0)) {
    throw new Error('Order amount is not payable');
  }
  const deliveryMajor = currency === 'NGN' ? CHECKOUT_DELIVERY_FEE_NGN : 0;
  const amountMajor = roundMajor(merchandiseMajor + deliveryMajor);
  return {
    currency,
    amountMajor,
    amountMinor: toMinorUnits(amountMajor, currency),
    merchandiseMajor,
    deliveryMajor,
  };
}
