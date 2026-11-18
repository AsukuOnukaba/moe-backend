-- Phase 3: link product/artisan reviews to completed orders (unique per order)

ALTER TABLE "ProductReview" ADD COLUMN IF NOT EXISTS "orderId" INTEGER;
ALTER TABLE "ArtisanReview" ADD COLUMN IF NOT EXISTS "orderId" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "ProductReview_orderId_key" ON "ProductReview"("orderId");
CREATE INDEX IF NOT EXISTS "ProductReview_orderId_idx" ON "ProductReview"("orderId");
CREATE UNIQUE INDEX IF NOT EXISTS "ArtisanReview_orderId_key" ON "ArtisanReview"("orderId");
CREATE INDEX IF NOT EXISTS "ArtisanReview_orderId_idx" ON "ArtisanReview"("orderId");

DO $$ BEGIN
  ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ArtisanReview" ADD CONSTRAINT "ArtisanReview_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
