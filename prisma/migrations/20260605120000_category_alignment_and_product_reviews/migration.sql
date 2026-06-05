-- estimatedDelivery string field
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "estimatedDelivery" TEXT;

-- Product reviews
CREATE TABLE "ProductReview" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "review" TEXT,
    "status" TEXT NOT NULL DEFAULT 'approved',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductReview_customerId_productId_key" ON "ProductReview"("customerId", "productId");
CREATE INDEX "ProductReview_productId_idx" ON "ProductReview"("productId");

ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Category value alignment (legacy → canonical)
UPDATE "Product" SET "category" = 'jewellery' WHERE "category" = 'accessories';
UPDATE "Product" SET "category" = 'home_and_decor' WHERE "category" = 'furniture';
UPDATE "Product" SET "category" = 'arts_and_crafts' WHERE "category" IN ('art', 'canvas', 'crafts');

UPDATE "ArtisanProfile" SET "category" = 'jewellery' WHERE "category" = 'accessories';
UPDATE "ArtisanProfile" SET "category" = 'home_and_decor' WHERE "category" = 'furniture';
UPDATE "ArtisanProfile" SET "category" = 'arts_and_crafts' WHERE "category" IN ('art', 'canvas', 'crafts');
