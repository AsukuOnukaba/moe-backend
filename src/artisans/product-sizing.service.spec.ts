import { BadRequestException } from '@nestjs/common';
import { validateSizeProfiles } from './product-sizing.service';
import type { ProductSizeProfileInputDto } from './dto/product-sizing.dto';

const profile = (
  audience: string,
  measurementKey: string,
  value: number,
): ProductSizeProfileInputDto => ({
  audience,
  productType: 'apparel',
  sizingSystem: `${audience} house chart`,
  unit: 'cm',
  measurementDefinitions: [
    { key: measurementKey, label: measurementKey, kind: 'body', required: true },
  ],
  isMadeToMeasure: false,
  sizes: [{ label: 'XL', measurements: { [measurementKey]: value } }],
  fitChoices: [],
});

describe('audience-specific product sizing validation', () => {
  it('keeps identically named men and women sizes independent', () => {
    const profiles = [profile('men', 'chest', 112), profile('women', 'bust', 108)];
    expect(() => validateSizeProfiles('tailoring', ['men', 'women'], profiles, true)).not.toThrow();
    expect(profiles[0].sizes[0].measurements).toEqual({ chest: 112 });
    expect(profiles[1].sizes[0].measurements).toEqual({ bust: 108 });
  });

  it('rejects incomplete required measurements for standard sizing', () => {
    const incomplete = profile('women', 'bust', 108);
    incomplete.sizes[0].measurements = {};
    expect(() => validateSizeProfiles('tailoring', ['women'], [incomplete], true)).toThrow(
      BadRequestException,
    );
  });

  it('does not impose apparel sizing on unrelated categories', () => {
    expect(() => validateSizeProfiles('furniture', [], undefined, true)).not.toThrow();
  });

  it('allows made-to-measure profiles without standard labels', () => {
    const madeToMeasure = profile('men', 'chest', 112);
    madeToMeasure.isMadeToMeasure = true;
    madeToMeasure.sizes = [];
    expect(() => validateSizeProfiles('tailoring', ['men'], [madeToMeasure], true)).not.toThrow();
  });
});
