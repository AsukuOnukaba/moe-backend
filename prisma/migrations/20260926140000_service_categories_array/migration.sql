-- Convert ArtisanProfile.serviceCategories from comma-separated TEXT to TEXT[].
ALTER TABLE "ArtisanProfile"
  ADD COLUMN "serviceCategories_new" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "ArtisanProfile"
SET "serviceCategories_new" = CASE
  WHEN "serviceCategories" IS NULL OR TRIM("serviceCategories") = '' THEN ARRAY[]::TEXT[]
  ELSE (
    SELECT COALESCE(
      ARRAY_AGG(TRIM(part)) FILTER (WHERE TRIM(part) <> ''),
      ARRAY[]::TEXT[]
    )
    FROM unnest(string_to_array("serviceCategories", ',')) AS part
  )
END;

ALTER TABLE "ArtisanProfile" DROP COLUMN "serviceCategories";
ALTER TABLE "ArtisanProfile" RENAME COLUMN "serviceCategories_new" TO "serviceCategories";
