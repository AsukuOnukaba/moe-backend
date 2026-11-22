import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export type SizingSelectionInput = {
  audience?: unknown;
  profileId?: unknown;
  sizeId?: unknown;
  fitChoiceId?: unknown;
};

export type SizingSelectionSnapshot = {
  audience: string;
  profileId: string;
  profileVersion: number;
  productType: string;
  sizingSystem: string;
  unit: string;
  measurementDefinitions: unknown;
  size: { id: string; label: string; measurements: unknown } | null;
  fitChoice: { id: string; label: string; description: string; illustrationUrl: string | null } | null;
};

function fail(message: string): never {
  throw new BadRequestException({ message, code: 'INVALID_SIZE_SELECTION' });
}

const copyJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Resolve identifiers against the current product and copy an immutable checkout snapshot. */
export async function resolveSizingSelection(
  prisma: PrismaService,
  productId: number,
  input: SizingSelectionInput | null | undefined,
): Promise<SizingSelectionSnapshot | null> {
  const profiles = await prisma.productSizeProfile.findMany({
    where: { productId },
    include: { sizes: true, fitChoices: true },
  });
  if (profiles.length === 0) return null; // Legacy product compatibility.
  if (!input || typeof input !== 'object') fail('Choose an audience and size for this product');

  const profileId = typeof input.profileId === 'string' ? input.profileId : '';
  const audience = typeof input.audience === 'string' ? input.audience : '';
  const profile = profiles.find((row) => row.id === profileId && row.audience === audience);
  if (!profile) fail('The selected size profile does not belong to this product and audience');

  const sizeId = typeof input.sizeId === 'string' ? input.sizeId : '';
  const size = sizeId ? profile.sizes.find((row) => row.id === sizeId) : null;
  if (!profile.isMadeToMeasure && !size) fail('Choose an available size for the selected audience');

  const fitChoiceId = typeof input.fitChoiceId === 'string' ? input.fitChoiceId : '';
  const fit = fitChoiceId ? profile.fitChoices.find((row) => row.id === fitChoiceId) : null;
  if (fitChoiceId && !fit) fail('The selected fit preference is not available for this audience');

  return {
    audience: profile.audience,
    profileId: profile.id,
    profileVersion: profile.version,
    productType: profile.productType,
    sizingSystem: profile.sizingSystem,
    unit: profile.unit,
    measurementDefinitions: copyJson(profile.measurementDefinitions),
    size: size ? { id: size.id, label: size.label, measurements: copyJson(size.measurements) } : null,
    fitChoice: fit
      ? { id: fit.id, label: fit.label, description: fit.description, illustrationUrl: fit.illustrationUrl }
      : null,
  };
}
