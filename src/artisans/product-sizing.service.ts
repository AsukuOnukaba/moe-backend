import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type {
  ProductSizeProfileInputDto,
  SizeMeasurementDefinitionDto,
} from './dto/product-sizing.dto';

const SIZING_CATEGORIES = new Set(['tailoring', 'shoemaking']);

function invalid(message: string): never {
  throw new BadRequestException({ message, code: 'INVALID_SIZE_PROFILE' });
}

export function requiresStructuredSizing(category?: string | null) {
  return SIZING_CATEGORIES.has((category ?? '').toLowerCase());
}

function isValidMeasurement(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  if (!value || typeof value !== 'object') return false;
  const range = value as { min?: unknown; max?: unknown };
  return (
    typeof range.min === 'number' &&
    typeof range.max === 'number' &&
    Number.isFinite(range.min) &&
    Number.isFinite(range.max) &&
    range.min > 0 &&
    range.max >= range.min
  );
}

export function validateSizeProfiles(
  category: string | null | undefined,
  designedFor: string[],
  profiles: ProductSizeProfileInputDto[] | undefined,
  enforce: boolean,
) {
  if (!enforce || !requiresStructuredSizing(category)) return;
  if (!profiles?.length) invalid('At least one audience-specific size profile is required');

  const audiences = new Set<string>();
  for (const profile of profiles) {
    if (!designedFor.includes(profile.audience)) {
      invalid(`Size profile audience ${profile.audience} is not selected in Designed For`);
    }
    if (audiences.has(profile.audience)) invalid(`Only one ${profile.audience} size profile is allowed`);
    audiences.add(profile.audience);
    if (!['cm', 'in'].includes(profile.unit)) invalid(`Invalid unit for ${profile.audience}`);
    if (!profile.sizingSystem?.trim()) invalid(`Sizing system is required for ${profile.audience}`);
    if (!profile.measurementDefinitions?.length) invalid(`Measurement definitions are required for ${profile.audience}`);
    const definitions = profile.measurementDefinitions as SizeMeasurementDefinitionDto[];
    const keys = new Set<string>();
    for (const definition of definitions) {
      if (!definition.key?.trim() || keys.has(definition.key)) invalid(`Measurement keys must be unique for ${profile.audience}`);
      keys.add(definition.key);
    }
    if (profile.isMadeToMeasure) continue;
    if (!profile.sizes?.length) invalid(`At least one offered size is required for ${profile.audience}`);
    const labels = new Set<string>();
    for (const size of profile.sizes) {
      if (!size.label?.trim() || labels.has(size.label.trim().toLowerCase())) invalid(`Size labels must be unique for ${profile.audience}`);
      labels.add(size.label.trim().toLowerCase());
      for (const definition of definitions.filter((item) => item.required !== false)) {
        if (!isValidMeasurement(size.measurements?.[definition.key])) {
          invalid(`${profile.audience} ${size.label} requires a valid ${definition.label} measurement`);
        }
      }
    }
  }

  for (const audience of designedFor) {
    if (!audiences.has(audience)) invalid(`A size profile is required for ${audience}`);
  }
}

@Injectable()
export class ProductSizingService {
  constructor(private readonly prisma: PrismaService) {}

  async replaceForProduct(productId: number, profiles: ProductSizeProfileInputDto[]) {
    await this.prisma.$transaction(async (tx) => {
      const keepProfileIds = profiles.map((profile) => profile.id).filter((id): id is string => !!id);
      await tx.productSizeProfile.deleteMany({ where: { productId, ...(keepProfileIds.length ? { id: { notIn: keepProfileIds } } : {}) } });

      for (const [profileIndex, input] of profiles.entries()) {
        const existing = input.id
          ? await tx.productSizeProfile.findFirst({ where: { id: input.id, productId } })
          : null;
        const profile = existing
          ? await tx.productSizeProfile.update({
              where: { id: existing.id },
              data: {
                audience: input.audience,
                productType: input.productType.trim(),
                sizingSystem: input.sizingSystem.trim(),
                unit: input.unit,
                measurementDefinitions: input.measurementDefinitions as object[],
                isMadeToMeasure: input.isMadeToMeasure === true,
                instructions: input.instructions?.trim() || null,
                illustrationUrl: input.illustrationUrl || null,
                version: { increment: 1 },
              },
            })
          : await tx.productSizeProfile.create({
              data: {
                productId,
                audience: input.audience,
                productType: input.productType.trim(),
                sizingSystem: input.sizingSystem.trim(),
                unit: input.unit,
                measurementDefinitions: input.measurementDefinitions as object[],
                isMadeToMeasure: input.isMadeToMeasure === true,
                instructions: input.instructions?.trim() || null,
                illustrationUrl: input.illustrationUrl || null,
              },
            });

        const sizeIds = input.sizes.map((size) => size.id).filter((id): id is string => !!id);
        await tx.productSizeOption.deleteMany({ where: { profileId: profile.id, ...(sizeIds.length ? { id: { notIn: sizeIds } } : {}) } });
        for (const [position, size] of input.sizes.entries()) {
          const owned = size.id ? await tx.productSizeOption.findFirst({ where: { id: size.id, profileId: profile.id } }) : null;
          const data = { label: size.label.trim(), measurements: size.measurements as object, position: size.position ?? position };
          if (owned) await tx.productSizeOption.update({ where: { id: owned.id }, data });
          else await tx.productSizeOption.create({ data: { profileId: profile.id, ...data } });
        }

        const fits = input.fitChoices ?? [];
        const fitIds = fits.map((fit) => fit.id).filter((id): id is string => !!id);
        await tx.productFitChoice.deleteMany({ where: { profileId: profile.id, ...(fitIds.length ? { id: { notIn: fitIds } } : {}) } });
        for (const [position, fit] of fits.entries()) {
          const owned = fit.id ? await tx.productFitChoice.findFirst({ where: { id: fit.id, profileId: profile.id } }) : null;
          const data = { label: fit.label.trim(), description: fit.description.trim(), illustrationUrl: fit.illustrationUrl || null, position: fit.position ?? position };
          if (owned) await tx.productFitChoice.update({ where: { id: owned.id }, data });
          else await tx.productFitChoice.create({ data: { profileId: profile.id, ...data } });
        }
        void profileIndex;
      }
    });
  }
}
