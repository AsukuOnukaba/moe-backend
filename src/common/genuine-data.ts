import type { Prisma } from '@prisma/client';

/** Test fixtures remain inspectable in order dashboards but never count as commerce. */
export const genuineOrderScope: Prisma.OrderWhereInput = {
  isTestOrder: false,
};

/** Reviews from test users/orders must not affect public ratings or analytics. */
export const genuineProductReviewScope: Prisma.ProductReviewWhereInput = {
  customer: { isTestUser: false },
  OR: [{ orderId: null }, { order: { is: { isTestOrder: false } } }],
};

export const genuineArtisanReviewScope: Prisma.ArtisanReviewWhereInput = {
  customer: { isTestUser: false },
  OR: [{ orderId: null }, { order: { is: { isTestOrder: false } } }],
};
