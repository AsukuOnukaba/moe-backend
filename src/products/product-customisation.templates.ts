export type CustomisationFieldType = 'select' | 'text' | 'number' | 'multiselect';

export type CustomisationField = {
  key: string;
  label: string;
  type: CustomisationFieldType;
  options?: string[];
};

const TEMPLATES: Record<string, CustomisationField[]> = {
  shoemaking: [
    { key: 'size', label: 'Size', type: 'select', options: ['EU 38', 'EU 39', 'EU 40', 'EU 41', 'EU 42', 'EU 43', 'EU 44', 'UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'US 7', 'US 8', 'US 9', 'US 10', 'US 11'] },
    { key: 'width', label: 'Width', type: 'select', options: ['narrow', 'standard', 'wide'] },
    { key: 'footType', label: 'Foot type', type: 'select', options: ['flat', 'neutral', 'high arch'] },
  ],
  tailoring: [
    { key: 'chest', label: 'Chest (cm)', type: 'number' },
    { key: 'waist', label: 'Waist (cm)', type: 'number' },
    { key: 'hips', label: 'Hips (cm)', type: 'number' },
    { key: 'height', label: 'Height (cm)', type: 'number' },
    { key: 'fitPreference', label: 'Fit preference', type: 'select', options: ['slim', 'regular', 'oversized'] },
  ],
  leatherwork: [
    { key: 'dimensions', label: 'Dimensions', type: 'text' },
    { key: 'strapLength', label: 'Strap length', type: 'text' },
    { key: 'colorPreference', label: 'Color preference', type: 'text' },
  ],
  canvas: [
    { key: 'canvasSize', label: 'Canvas size', type: 'select', options: ['small', 'medium', 'large', 'extra large'] },
    { key: 'colorPalette', label: 'Color palette', type: 'text' },
    { key: 'inscription', label: 'Inscription', type: 'text' },
  ],
  beauty: [
    { key: 'skinTone', label: 'Skin tone', type: 'select', options: ['fair', 'medium', 'deep'] },
    { key: 'finishPreference', label: 'Finish preference', type: 'select', options: ['matte', 'dewy', 'natural'] },
  ],
  crafts: [
    { key: 'dimensions', label: 'Dimensions', type: 'text' },
    { key: 'materialPreference', label: 'Material preference', type: 'text' },
  ],
};

export function getCustomisationTemplate(category: string): CustomisationField[] {
  const key = category.trim().toLowerCase();
  return TEMPLATES[key] ?? [];
}

export function validateCustomisationPayload(
  category: string,
  payload: Record<string, unknown>,
): { valid: boolean; unknownKeys: string[] } {
  const template = getCustomisationTemplate(category);
  const allowedKeys = new Set(template.map((f) => f.key));
  const unknownKeys = Object.keys(payload).filter((k) => !allowedKeys.has(k));
  return { valid: unknownKeys.length === 0, unknownKeys };
}
