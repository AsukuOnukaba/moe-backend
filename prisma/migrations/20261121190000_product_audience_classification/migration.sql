-- Additive audience classification. Existing products remain unclassified and visible
-- in all general marketplace collections until an admin or artisan classifies them.
ALTER TABLE "Product"
  ADD COLUMN "designedFor" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "audienceClassificationStatus" TEXT NOT NULL DEFAULT 'unclassified',
  ADD COLUMN "audienceClassifiedAt" TIMESTAMP(3),
  ADD COLUMN "audienceClassifiedById" INTEGER;

CREATE INDEX "Product_audienceClassificationStatus_idx"
  ON "Product"("audienceClassificationStatus");
