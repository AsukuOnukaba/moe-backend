import { BadRequestException } from '@nestjs/common';
import { resolveSizingSelection } from './product-sizing-selection';

const menProfile = {
  id: '11111111-1111-4111-8111-111111111111',
  productId: 10,
  audience: 'men',
  productType: 'apparel',
  sizingSystem: 'Men chart',
  unit: 'cm',
  version: 2,
  isMadeToMeasure: false,
  measurementDefinitions: [{ key: 'chest', label: 'Chest', kind: 'body', required: true }],
  sizes: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', label: 'XL', measurements: { chest: 112 } }],
  fitChoices: [],
};

const womenProfile = {
  ...menProfile,
  id: '22222222-2222-4222-8222-222222222222',
  audience: 'women',
  sizingSystem: 'Women chart',
  version: 4,
  measurementDefinitions: [{ key: 'bust', label: 'Bust', kind: 'body', required: true }],
  sizes: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', label: 'XL', measurements: { bust: 108 } }],
  fitChoices: [{ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', label: 'Regular fit', description: 'Balanced ease', illustrationUrl: null }],
};

const prisma = {
  productSizeProfile: {
    findMany: jest.fn().mockResolvedValue([menProfile, womenProfile]),
  },
} as any;

describe('checkout sizing snapshot', () => {
  it('resolves the selected audience-specific size and chart version', async () => {
    const snapshot = await resolveSizingSelection(prisma, 10, {
      audience: 'women',
      profileId: womenProfile.id,
      sizeId: womenProfile.sizes[0].id,
      fitChoiceId: womenProfile.fitChoices[0].id,
    });
    expect(snapshot).toMatchObject({
      audience: 'women',
      profileId: womenProfile.id,
      profileVersion: 4,
      sizingSystem: 'Women chart',
      size: { label: 'XL', measurements: { bust: 108 } },
      fitChoice: { label: 'Regular fit' },
    });
  });

  it('rejects a size from another audience profile', async () => {
    await expect(
      resolveSizingSelection(prisma, 10, {
        audience: 'women',
        profileId: womenProfile.id,
        sizeId: menProfile.sizes[0].id,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps a copied measurement snapshot independent of later chart edits', async () => {
    const snapshot = await resolveSizingSelection(prisma, 10, {
      audience: 'women',
      profileId: womenProfile.id,
      sizeId: womenProfile.sizes[0].id,
    });
    womenProfile.sizes[0].measurements.bust = 110;
    expect(snapshot?.size?.measurements).toEqual({ bust: 108 });
    womenProfile.sizes[0].measurements.bust = 108;
  });
});
