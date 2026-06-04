export type CustomisationFieldType = 'select' | 'text' | 'number' | 'multiselect';

export type CustomisationField = {
  key: string;
  label: string;
  type: CustomisationFieldType;
  options?: string[];
  required?: boolean;
};

/** Maps client keywords (product name / legacy category) to template keys. */
const CATEGORY_ALIASES: Record<string, string> = {
  canvas: 'canvas',
  crafts: 'crafts',
  'canvas & art': 'art',
  jewelry: 'accessories',
  'leather goods': 'leatherwork',
  footwear: 'shoemaking',
  fashion: 'tailoring',
};

const TEMPLATES: Record<string, CustomisationField[]> = {
  tailoring: [
    {
      key: 'fabric',
      label: 'Fabric',
      type: 'select',
      options: ['Ankara', 'Adire', 'Linen', 'Cotton', 'Silk', 'Wool'],
      required: true,
    },
    {
      key: 'lining',
      label: 'Lining',
      type: 'multiselect',
      options: ['Cotton', 'Silk', 'Polyester'],
    },
    { key: 'chest', label: 'Chest (cm)', type: 'number' },
    { key: 'waist', label: 'Waist (cm)', type: 'number' },
    { key: 'hips', label: 'Hips (cm)', type: 'number' },
    { key: 'height', label: 'Height (cm)', type: 'number' },
    {
      key: 'fitPreference',
      label: 'Fit preference',
      type: 'select',
      options: ['slim', 'regular', 'oversized'],
    },
    { key: 'notes', label: 'Notes', type: 'text' },
  ],
  shoemaking: [
    {
      key: 'size',
      label: 'Size',
      type: 'select',
      options: [
        'EU 38',
        'EU 39',
        'EU 40',
        'EU 41',
        'EU 42',
        'EU 43',
        'EU 44',
        'UK 6',
        'UK 7',
        'UK 8',
        'UK 9',
        'UK 10',
        'US 7',
        'US 8',
        'US 9',
        'US 10',
        'US 11',
      ],
      required: true,
    },
    {
      key: 'width',
      label: 'Width',
      type: 'select',
      options: ['narrow', 'standard', 'wide'],
    },
    {
      key: 'footType',
      label: 'Foot type',
      type: 'select',
      options: ['flat', 'neutral', 'high arch'],
    },
  ],
  leatherwork: [
    { key: 'dimensions', label: 'Dimensions', type: 'text' },
    { key: 'strapLength', label: 'Strap length', type: 'text' },
    { key: 'colorPreference', label: 'Color preference', type: 'text', required: true },
  ],
  beauty: [
    {
      key: 'skinTone',
      label: 'Skin tone',
      type: 'select',
      options: ['fair', 'medium', 'deep'],
      required: true,
    },
    {
      key: 'finishPreference',
      label: 'Finish preference',
      type: 'select',
      options: ['matte', 'dewy', 'natural'],
    },
  ],
  accessories: [
    {
      key: 'size',
      label: 'Size',
      type: 'select',
      options: ['XS', 'S', 'M', 'L', 'XL', 'one size'],
    },
    { key: 'colorPreference', label: 'Color preference', type: 'text' },
    { key: 'materialPreference', label: 'Material preference', type: 'text' },
  ],
  furniture: [
    { key: 'dimensions', label: 'Dimensions', type: 'text', required: true },
    {
      key: 'woodFinish',
      label: 'Wood finish',
      type: 'select',
      options: ['natural', 'stained', 'painted', 'varnished'],
    },
    { key: 'notes', label: 'Notes', type: 'text' },
  ],
  art: [
    {
      key: 'canvasSize',
      label: 'Canvas size',
      type: 'select',
      options: ['small', 'medium', 'large', 'extra large'],
      required: true,
    },
    { key: 'colorPalette', label: 'Color palette', type: 'text' },
    { key: 'inscription', label: 'Inscription', type: 'text' },
  ],
  canvas: [
    {
      key: 'canvasSize',
      label: 'Canvas size',
      type: 'select',
      options: ['small', 'medium', 'large', 'extra large'],
      required: true,
    },
    { key: 'colorPalette', label: 'Color palette', type: 'text' },
    { key: 'inscription', label: 'Inscription', type: 'text' },
  ],
  crafts: [
    { key: 'dimensions', label: 'Dimensions', type: 'text' },
    { key: 'materialPreference', label: 'Material preference', type: 'text' },
  ],
};

function resolveTemplateKey(category: string): string {
  const raw = category.trim().toLowerCase();
  if (TEMPLATES[raw]) return raw;
  if (CATEGORY_ALIASES[raw]) return CATEGORY_ALIASES[raw];
  for (const [alias, key] of Object.entries(CATEGORY_ALIASES)) {
    if (raw.includes(alias)) return key;
  }
  return raw;
}

export function getCustomisationTemplate(category: string): CustomisationField[] {
  const key = resolveTemplateKey(category);
  return TEMPLATES[key] ?? [];
}

export function validateCustomisationPayload(
  category: string,
  payload: Record<string, unknown>,
): { valid: boolean; unknownKeys: string[]; missingRequired: string[] } {
  const template = getCustomisationTemplate(category);
  const allowedKeys = new Set(template.map((f) => f.key));
  const unknownKeys = Object.keys(payload).filter((k) => !allowedKeys.has(k));
  const missingRequired = template
    .filter((f) => f.required && (payload[f.key] === undefined || payload[f.key] === ''))
    .map((f) => f.key);
  return {
    valid: unknownKeys.length === 0 && missingRequired.length === 0,
    unknownKeys,
    missingRequired,
  };
}
