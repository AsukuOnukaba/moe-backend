-- Product listing thumbnails
CREATE INDEX IF NOT EXISTS "Product_artisanId_status_idx" ON "Product"("artisanId", "status");

-- Behaviour event view aggregation
CREATE INDEX IF NOT EXISTS "UserBehaviourEvent_entityId_eventType_createdAt_idx"
  ON "UserBehaviourEvent"("entityId", "eventType", "createdAt");

-- CustomOrder field extensions
ALTER TABLE "CustomOrder" ADD COLUMN IF NOT EXISTS "budgetMin" DOUBLE PRECISION;
ALTER TABLE "CustomOrder" ADD COLUMN IF NOT EXISTS "budgetMax" DOUBLE PRECISION;
ALTER TABLE "CustomOrder" ADD COLUMN IF NOT EXISTS "specialInstructions" TEXT;
ALTER TABLE "CustomOrder" ADD COLUMN IF NOT EXISTS "categoryFields" JSONB;

-- Convert deadline TEXT -> TIMESTAMP (best-effort)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'CustomOrder'
      AND column_name = 'deadline'
      AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE "CustomOrder" ADD COLUMN "deadline_ts" TIMESTAMP(3);
    UPDATE "CustomOrder"
    SET "deadline_ts" = CASE
      WHEN "deadline" IS NULL OR TRIM("deadline") = '' THEN NULL
      WHEN "deadline" ~ '^\d{4}-\d{2}-\d{2}' THEN ("deadline")::timestamp
      ELSE NULL
    END;
    ALTER TABLE "CustomOrder" DROP COLUMN "deadline";
    ALTER TABLE "CustomOrder" RENAME COLUMN "deadline_ts" TO "deadline";
  END IF;
END $$;

-- CustomOrderRank (separate from ArtisanScore curation)
CREATE TABLE IF NOT EXISTS "CustomOrderRank" (
    "id" TEXT NOT NULL,
    "artisanId" INTEGER NOT NULL,
    "fulfilmentRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "satisfactionScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgResponseTimeHrs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "compositeRank" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastCalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomOrderRank_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomOrderRank_artisanId_key" ON "CustomOrderRank"("artisanId");
CREATE INDEX IF NOT EXISTS "CustomOrderRank_compositeRank_idx" ON "CustomOrderRank"("compositeRank");

DO $$ BEGIN
  ALTER TABLE "CustomOrderRank" ADD CONSTRAINT "CustomOrderRank_artisanId_fkey"
    FOREIGN KEY ("artisanId") REFERENCES "ArtisanProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
