/*
  Warnings:

  - Added the required column `providerId` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "category" TEXT,
ADD COLUMN     "discountPercent" DOUBLE PRECISION,
ADD COLUMN     "estimatedDeliveryDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isBestSeller" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isNewArrival" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isTrending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "materials" TEXT,
ADD COLUMN     "providerId" INTEGER NOT NULL,
ADD COLUMN     "tags" TEXT;

-- CreateTable
CREATE TABLE "ArtisanProfile" (
    "userId" INTEGER NOT NULL,
    "brandName" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "about" TEXT,
    "city" TEXT,
    "state" TEXT,
    "category" TEXT,
    "styleTags" TEXT,
    "serviceCategories" TEXT,
    "heroImage" TEXT,
    "customOrdersEnabled" BOOLEAN NOT NULL DEFAULT false,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "estimatedDeliveryDays" INTEGER NOT NULL DEFAULT 7,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ArtisanProfile_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "ArtisanProfile" ADD CONSTRAINT "ArtisanProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
