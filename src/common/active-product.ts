import type { Prisma } from '@prisma/client';

/** Excludes soft-deleted products from non-admin reads. */
export const activeProductWhere: Prisma.ProductWhereInput = {
  deletedAt: null,
};

export function withActiveProduct<T extends Prisma.ProductWhereInput>(
  where: T = {} as T,
): T & { deletedAt: null } {
  return { ...where, deletedAt: null };
}
