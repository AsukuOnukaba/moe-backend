import { PrismaService } from '../database/prisma.service';

export type StorefrontProfile = {
  id: number;
  brandName?: string | null;
  businessName?: string | null;
  name?: string | null;
  about?: string | null;
  description?: string | null;
  city?: string | null;
  state?: string | null;
  category?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  country?: string | null;
};

function norm(value?: string | null): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Identity of a public storefront. Incomplete profiles return null and are
 * never collapsed. The same name alone is not enough: city, description, and
 * category must match as well.
 */
export function storefrontKey(profile: StorefrontProfile): string | null {
  const brand = norm(profile.brandName) || norm(profile.businessName) || norm(profile.name);
  const about = norm(profile.about) || norm(profile.description);
  const city = norm(profile.city);
  const state = norm(profile.state);
  const category = norm(profile.category);
  if (!brand || !about || !city || !state || !category) return null;
  return JSON.stringify([
    brand,
    about,
    city,
    state,
    category,
    norm(profile.firstName),
    norm(profile.lastName),
    norm(profile.country),
  ]);
}

/** Later copies of the same storefront. The lowest id is the one listings keep. */
export function excludedStorefrontIds(profiles: StorefrontProfile[]): number[] {
  const canonical = new Map<string, number>();
  for (const profile of profiles) {
    const key = storefrontKey(profile);
    if (!key || !Number.isFinite(profile.id)) continue;
    const current = canonical.get(key);
    if (current == null || profile.id < current) canonical.set(key, profile.id);
  }
  const exclude: number[] = [];
  for (const profile of profiles) {
    const key = storefrontKey(profile);
    if (!key) continue;
    if (canonical.get(key) !== profile.id) exclude.push(profile.id);
  }
  return exclude;
}

export function uniqueIds(ids: number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const id of ids) {
    if (!Number.isFinite(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export async function loadExcludedStorefrontIds(prisma: PrismaService): Promise<number[]> {
  const rows = await prisma.user.findMany({
    where: { artisanProfile: { is: { status: 'approved' } } },
    select: {
      id: true,
      name: true,
      artisanProfile: {
        select: {
          brandName: true,
          businessName: true,
          about: true,
          description: true,
          city: true,
          state: true,
          category: true,
          firstName: true,
          lastName: true,
          country: true,
        },
      },
    },
  });
  return excludedStorefrontIds(
    rows.flatMap((row) => {
      if (!row.artisanProfile) return [];
      return [{ id: row.id, name: row.name, ...row.artisanProfile }];
    }),
  );
}

export async function catalogueProviderFilter(
  prisma: PrismaService,
): Promise<{ notIn: number[] } | undefined> {
  const excluded = await loadExcludedStorefrontIds(prisma);
  if (!excluded.length) return undefined;
  return { notIn: excluded };
}
