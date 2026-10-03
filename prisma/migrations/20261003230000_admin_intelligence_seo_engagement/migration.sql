-- ArtisanScore (admin-only internal scoring)
CREATE TABLE "ArtisanScore" (
    "id" TEXT NOT NULL,
    "artisanId" INTEGER NOT NULL,
    "orderCompletionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgResponseTimeHrs" DOUBLE PRECISION,
    "reviewQualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "compositeScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastCalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtisanScore_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ArtisanScore_artisanId_key" ON "ArtisanScore"("artisanId");
CREATE INDEX "ArtisanScore_compositeScore_idx" ON "ArtisanScore"("compositeScore");

ALTER TABLE "ArtisanScore" ADD CONSTRAINT "ArtisanScore_artisanId_fkey"
  FOREIGN KEY ("artisanId") REFERENCES "ArtisanProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Curation
CREATE TABLE "CuratedSection" (
    "id" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "CuratedSection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CuratedSection_sectionKey_key" ON "CuratedSection"("sectionKey");
CREATE INDEX "CuratedSection_isActive_idx" ON "CuratedSection"("isActive");

CREATE TABLE "CuratedItem" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "addedBy" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CuratedItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CuratedItem_sectionId_itemId_key" ON "CuratedItem"("sectionId", "itemId");
CREATE INDEX "CuratedItem_sectionId_position_idx" ON "CuratedItem"("sectionId", "position");
CREATE INDEX "CuratedItem_sectionId_isActive_idx" ON "CuratedItem"("sectionId", "isActive");

ALTER TABLE "CuratedItem" ADD CONSTRAINT "CuratedItem_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "CuratedSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the four supported section configs (no curated items)
INSERT INTO "CuratedSection" ("id", "sectionKey", "label", "isActive", "keywords", "updatedAt", "updatedBy")
VALUES
  (gen_random_uuid()::text, 'featured_picks', 'Best Sellers', true, ARRAY[]::TEXT[], CURRENT_TIMESTAMP, 'system'),
  (gen_random_uuid()::text, 'featured_artisans', 'Featured Artisans', true, ARRAY[]::TEXT[], CURRENT_TIMESTAMP, 'system'),
  (gen_random_uuid()::text, 'featured_styles', 'Editor''s Recommendations', true, ARRAY[]::TEXT[], CURRENT_TIMESTAMP, 'system'),
  (gen_random_uuid()::text, 'seasonal_picks', 'Seasonal Picks', true, ARRAY[]::TEXT[], CURRENT_TIMESTAMP, 'system')
ON CONFLICT ("sectionKey") DO NOTHING;

-- Keywords
CREATE TABLE "Keyword" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Keyword_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Keyword_term_key" ON "Keyword"("term");

CREATE TABLE "ProductKeyword" (
    "productId" INTEGER NOT NULL,
    "keywordId" TEXT NOT NULL,

    CONSTRAINT "ProductKeyword_pkey" PRIMARY KEY ("productId","keywordId")
);

CREATE INDEX "ProductKeyword_keywordId_idx" ON "ProductKeyword"("keywordId");

ALTER TABLE "ProductKeyword" ADD CONSTRAINT "ProductKeyword_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductKeyword" ADD CONSTRAINT "ProductKeyword_keywordId_fkey"
  FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ArtisanKeyword" (
    "artisanId" INTEGER NOT NULL,
    "keywordId" TEXT NOT NULL,

    CONSTRAINT "ArtisanKeyword_pkey" PRIMARY KEY ("artisanId","keywordId")
);

CREATE INDEX "ArtisanKeyword_keywordId_idx" ON "ArtisanKeyword"("keywordId");

ALTER TABLE "ArtisanKeyword" ADD CONSTRAINT "ArtisanKeyword_artisanId_fkey"
  FOREIGN KEY ("artisanId") REFERENCES "ArtisanProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArtisanKeyword" ADD CONSTRAINT "ArtisanKeyword_keywordId_fkey"
  FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Behaviour events
CREATE TABLE "UserBehaviourEvent" (
    "id" TEXT NOT NULL,
    "userId" INTEGER,
    "sessionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBehaviourEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserBehaviourEvent_userId_idx" ON "UserBehaviourEvent"("userId");
CREATE INDEX "UserBehaviourEvent_sessionId_idx" ON "UserBehaviourEvent"("sessionId");
CREATE INDEX "UserBehaviourEvent_eventType_idx" ON "UserBehaviourEvent"("eventType");
CREATE INDEX "UserBehaviourEvent_entityId_idx" ON "UserBehaviourEvent"("entityId");
CREATE INDEX "UserBehaviourEvent_entityType_eventType_createdAt_idx"
  ON "UserBehaviourEvent"("entityType", "eventType", "createdAt");
CREATE INDEX "UserBehaviourEvent_sessionId_eventType_entityId_createdAt_idx"
  ON "UserBehaviourEvent"("sessionId", "eventType", "entityId", "createdAt");

ALTER TABLE "UserBehaviourEvent" ADD CONSTRAINT "UserBehaviourEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SEO + stock on Product / ArtisanProfile
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "metaTitle" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "metaDescription" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "stockCount" INTEGER;

ALTER TABLE "ArtisanProfile" ADD COLUMN IF NOT EXISTS "metaTitle" TEXT;
ALTER TABLE "ArtisanProfile" ADD COLUMN IF NOT EXISTS "metaDescription" TEXT;
