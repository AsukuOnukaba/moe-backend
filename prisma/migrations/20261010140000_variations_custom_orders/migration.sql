-- AlterTable
ALTER TABLE "ArtisanProfile" ADD COLUMN IF NOT EXISTS "isCustomOrderEligible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ArtisanProfile" ADD COLUMN IF NOT EXISTS "customOrderApprovedAt" TIMESTAMP(3);
ALTER TABLE "ArtisanProfile" ADD COLUMN IF NOT EXISTS "customOrderApprovedBy" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProductVariationType" (
    "id" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "typeName" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductVariationType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "VariationOption" (
    "id" TEXT NOT NULL,
    "variationTypeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "colorHex" TEXT,
    "priceOverride" DOUBLE PRECISION,
    "stockCount" INTEGER,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VariationOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CustomOrder" (
    "id" TEXT NOT NULL,
    "artisanId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "referenceImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "budget" DOUBLE PRECISION,
    "deadline" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "artisanResponse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomOrder_pkey" PRIMARY KEY ("id")
);

-- Indexes / FKs
CREATE INDEX IF NOT EXISTS "ProductVariationType_productId_idx" ON "ProductVariationType"("productId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariationType_productId_typeName_key" ON "ProductVariationType"("productId", "typeName");
CREATE INDEX IF NOT EXISTS "VariationOption_variationTypeId_idx" ON "VariationOption"("variationTypeId");
CREATE INDEX IF NOT EXISTS "CustomOrder_artisanId_idx" ON "CustomOrder"("artisanId");
CREATE INDEX IF NOT EXISTS "CustomOrder_customerId_idx" ON "CustomOrder"("customerId");
CREATE INDEX IF NOT EXISTS "CustomOrder_status_idx" ON "CustomOrder"("status");

DO $$ BEGIN
  ALTER TABLE "ProductVariationType" ADD CONSTRAINT "ProductVariationType_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "VariationOption" ADD CONSTRAINT "VariationOption_variationTypeId_fkey"
    FOREIGN KEY ("variationTypeId") REFERENCES "ProductVariationType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CustomOrder" ADD CONSTRAINT "CustomOrder_artisanId_fkey"
    FOREIGN KEY ("artisanId") REFERENCES "ArtisanProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CustomOrder" ADD CONSTRAINT "CustomOrder_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
