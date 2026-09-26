-- Remap legacy / mis-labeled product categories to the 8 canonical slugs.
-- Idempotent: safe to re-run; only touches non-canonical values.

-- accessories → jewellery
UPDATE "Product"
SET "category" = 'jewellery'
WHERE lower(trim("category")) IN ('accessories', 'accessory');

UPDATE "ArtisanProfile"
SET "category" = 'jewellery'
WHERE "category" IS NOT NULL
  AND lower(trim("category")) IN ('accessories', 'accessory');

-- canvas / Paintings and Canvas labels → paintings_and_canvas
UPDATE "Product"
SET "category" = 'paintings_and_canvas'
WHERE lower(trim("category")) IN (
  'canvas',
  'paintings and canvas',
  'paintings & canvas',
  'canvas & painting',
  'canvas and painting',
  'canvas & art',
  'canvas and art'
);

UPDATE "ArtisanProfile"
SET "category" = 'paintings_and_canvas'
WHERE "category" IS NOT NULL
  AND lower(trim("category")) IN (
    'canvas',
    'paintings and canvas',
    'paintings & canvas',
    'canvas & painting',
    'canvas and painting',
    'canvas & art',
    'canvas and art'
  );

-- Display labels that were saved instead of snake_case slugs
UPDATE "Product"
SET "category" = 'arts_and_crafts'
WHERE lower(trim("category")) IN ('arts & crafts', 'arts and crafts');

UPDATE "Product"
SET "category" = 'home_and_decor'
WHERE lower(trim("category")) IN ('home & decor', 'home and decor');

UPDATE "Product"
SET "category" = 'jewellery'
WHERE lower(trim("category")) IN ('jewelry', 'jewellery');

-- Ensure Category seed row exists for Browse by Category + counts
INSERT INTO "Category" ("id", "slug", "label", "icon", "isSeed", "sortOrder", "createdAt", "updatedAt")
VALUES (
  'cat_seed_paintings_and_canvas',
  'paintings_and_canvas',
  'Paintings and Canvas',
  'Palette',
  true,
  7,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO UPDATE SET
  "label" = EXCLUDED."label",
  "icon" = EXCLUDED."icon",
  "isSeed" = true,
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = CURRENT_TIMESTAMP;
