-- User email verification & OAuth
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "requiresEmailVerification" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailOtp" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailOtpExpiresAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "adminOtp" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "adminOtpExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "User_googleId_key" ON "User"("googleId");

-- Artisan profile review & rush order
ALTER TABLE "ArtisanProfile" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "ArtisanProfile" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
ALTER TABLE "ArtisanProfile" ADD COLUMN IF NOT EXISTS "rushOrderEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ArtisanProfile" ADD COLUMN IF NOT EXISTS "rushOrderSurchargePercent" DOUBLE PRECISION NOT NULL DEFAULT 25;

-- Product review & customisation
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "customisationRequired" BOOLEAN NOT NULL DEFAULT false;

-- Migrate legacy ACTIVE status to approved
UPDATE "Product" SET "status" = 'approved' WHERE "status" = 'ACTIVE' OR "status" IS NULL;
UPDATE "Product" SET "status" = 'pending' WHERE "status" NOT IN ('approved', 'pending', 'rejected', 'draft');

UPDATE "ArtisanProfile" SET "status" = 'approved';

-- Order rush & customisation
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "basePrice" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "rushSurcharge" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "rushOrder" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customisationData" JSONB;

-- Payment method fields
ALTER TABLE "PaymentMethod" ADD COLUMN IF NOT EXISTS "expiryMonth" INTEGER;
ALTER TABLE "PaymentMethod" ADD COLUMN IF NOT EXISTS "expiryYear" INTEGER;
ALTER TABLE "PaymentMethod" ADD COLUMN IF NOT EXISTS "processorToken" TEXT;

CREATE INDEX IF NOT EXISTS "Product_status_idx" ON "Product"("status");
