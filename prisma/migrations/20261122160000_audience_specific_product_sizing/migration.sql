CREATE TABLE "ProductSizeProfile" (
  "id" TEXT NOT NULL,
  "productId" INTEGER NOT NULL,
  "audience" TEXT NOT NULL,
  "productType" TEXT NOT NULL,
  "sizingSystem" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "measurementDefinitions" JSONB NOT NULL,
  "isMadeToMeasure" BOOLEAN NOT NULL DEFAULT false,
  "instructions" TEXT,
  "illustrationUrl" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductSizeProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductSizeOption" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "measurements" JSONB NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductSizeOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductFitChoice" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "illustrationUrl" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductFitChoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductSizeProfile_productId_audience_key" ON "ProductSizeProfile"("productId", "audience");
CREATE INDEX "ProductSizeProfile_productId_idx" ON "ProductSizeProfile"("productId");
CREATE UNIQUE INDEX "ProductSizeOption_profileId_label_key" ON "ProductSizeOption"("profileId", "label");
CREATE INDEX "ProductSizeOption_profileId_idx" ON "ProductSizeOption"("profileId");
CREATE UNIQUE INDEX "ProductFitChoice_profileId_label_key" ON "ProductFitChoice"("profileId", "label");
CREATE INDEX "ProductFitChoice_profileId_idx" ON "ProductFitChoice"("profileId");

ALTER TABLE "ProductSizeProfile" ADD CONSTRAINT "ProductSizeProfile_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductSizeOption" ADD CONSTRAINT "ProductSizeOption_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ProductSizeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductFitChoice" ADD CONSTRAINT "ProductFitChoice_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ProductSizeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
