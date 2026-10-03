import type { Prisma } from '@prisma/client';

/** Excludes soft-deleted products from non-admin reads. */
export const activeProductWhere: Prisma.ProductWhereInput = {
  deletedAt: null,
};

/**
 * Publicly visible products — must be used for productCount on artisan
 * listing/detail AND for GET /artisans/:id/products (and provider products).
 */
export const publicProductWhere: Prisma.ProductWhereInput = {
  status: 'approved',
  ...activeProductWhere,
};

export function withActiveProduct<T extends Prisma.ProductWhereInput>(
  where: T = {} as T,
): T & { deletedAt: null } {
  return { ...where, deletedAt: null };
}
