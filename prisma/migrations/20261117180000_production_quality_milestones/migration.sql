-- Batch A/B/C: production monitoring, quality/delivery, milestone payouts

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "productionOriginalDeadline" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "qualityReviewStatus" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "qualitySubmittedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "qualityApprovedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "qualityApprovedById" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "fulfillmentStatus" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "dispatchedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customerAcceptedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customerReviewDeadline" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customerRating" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customerReview" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "finalPayoutReviewEligible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "finalPayoutEscalatedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Order_productionDeadline_idx" ON "Order"("productionDeadline");
CREATE INDEX IF NOT EXISTS "Order_qualityReviewStatus_idx" ON "Order"("qualityReviewStatus");
CREATE INDEX IF NOT EXISTS "Order_fulfillmentStatus_idx" ON "Order"("fulfillmentStatus");

ALTER TABLE "OrderArtisanPayout" ADD COLUMN IF NOT EXISTS "totalPayableAmount" DOUBLE PRECISION;
ALTER TABLE "OrderArtisanPayout" ADD COLUMN IF NOT EXISTS "totalPayableApprovedById" INTEGER;
ALTER TABLE "OrderArtisanPayout" ADD COLUMN IF NOT EXISTS "totalPayableApprovedAt" TIMESTAMP(3);
ALTER TABLE "OrderArtisanPayout" ADD COLUMN IF NOT EXISTS "totalPayableReason" TEXT;
ALTER TABLE "OrderArtisanPayout" ADD COLUMN IF NOT EXISTS "totalPayableExceptionApproved" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "OrderArtisanPayoutTransfer" ADD COLUMN IF NOT EXISTS "milestoneId" INTEGER;

CREATE TABLE IF NOT EXISTS "OrderArtisanPayoutMilestone" (
    "id" SERIAL NOT NULL,
    "payoutId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "approvedAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" TEXT NOT NULL DEFAULT 'planned',
    "dueConditions" JSONB,
    "amountApprovedById" INTEGER,
    "amountApprovedAt" TIMESTAMP(3),
    "eligibleAt" TIMESTAMP(3),
    "exceptionApproved" BOOLEAN NOT NULL DEFAULT false,
    "exceptionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderArtisanPayoutMilestone_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OrderArtisanPayoutMilestone_payoutId_sequence_idx" ON "OrderArtisanPayoutMilestone"("payoutId", "sequence");
CREATE INDEX IF NOT EXISTS "OrderArtisanPayoutMilestone_status_idx" ON "OrderArtisanPayoutMilestone"("status");

CREATE TABLE IF NOT EXISTS "OrderProductionProgressUpdate" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "artisanId" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "percentComplete" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderProductionProgressUpdate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OrderProductionProgressUpdate_orderId_createdAt_idx" ON "OrderProductionProgressUpdate"("orderId", "createdAt");
CREATE INDEX IF NOT EXISTS "OrderProductionProgressUpdate_artisanId_idx" ON "OrderProductionProgressUpdate"("artisanId");

CREATE TABLE IF NOT EXISTS "OrderProductionProgressEvidence" (
    "id" SERIAL NOT NULL,
    "progressUpdateId" INTEGER NOT NULL,
    "attachmentPublicId" TEXT NOT NULL,
    "attachmentResourceType" TEXT NOT NULL,
    "attachmentName" TEXT NOT NULL,
    "attachmentMimeType" TEXT NOT NULL,
    "attachmentBytes" INTEGER,
    "attachmentKind" TEXT NOT NULL,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderProductionProgressEvidence_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OrderProductionProgressEvidence_progressUpdateId_idx" ON "OrderProductionProgressEvidence"("progressUpdateId");

CREATE TABLE IF NOT EXISTS "OrderProductionDeadlineExtension" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "previousDeadline" TIMESTAMP(3) NOT NULL,
    "newDeadline" TIMESTAMP(3) NOT NULL,
    "extraHours" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "extendedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderProductionDeadlineExtension_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OrderProductionDeadlineExtension_orderId_createdAt_idx" ON "OrderProductionDeadlineExtension"("orderId", "createdAt");

CREATE TABLE IF NOT EXISTS "OrderProductionEvent" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "actorId" INTEGER,
    "action" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderProductionEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OrderProductionEvent_orderId_createdAt_idx" ON "OrderProductionEvent"("orderId", "createdAt");

CREATE TABLE IF NOT EXISTS "OrderProductionReminder" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderProductionReminder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "OrderProductionReminder_orderId_kind_key" ON "OrderProductionReminder"("orderId", "kind");
CREATE INDEX IF NOT EXISTS "OrderProductionReminder_orderId_idx" ON "OrderProductionReminder"("orderId");

CREATE TABLE IF NOT EXISTS "OrderQualitySubmission" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "artisanId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "description" TEXT NOT NULL,
    "specsConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "outstandingIssues" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderQualitySubmission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "OrderQualitySubmission_orderId_version_key" ON "OrderQualitySubmission"("orderId", "version");
CREATE INDEX IF NOT EXISTS "OrderQualitySubmission_orderId_status_idx" ON "OrderQualitySubmission"("orderId", "status");

CREATE TABLE IF NOT EXISTS "OrderQualityEvidence" (
    "id" SERIAL NOT NULL,
    "submissionId" INTEGER NOT NULL,
    "attachmentPublicId" TEXT NOT NULL,
    "attachmentResourceType" TEXT NOT NULL,
    "attachmentName" TEXT NOT NULL,
    "attachmentMimeType" TEXT NOT NULL,
    "attachmentBytes" INTEGER,
    "attachmentKind" TEXT NOT NULL,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderQualityEvidence_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OrderQualityEvidence_submissionId_idx" ON "OrderQualityEvidence"("submissionId");

CREATE TABLE IF NOT EXISTS "OrderQualityReview" (
    "id" SERIAL NOT NULL,
    "submissionId" INTEGER NOT NULL,
    "reviewerId" INTEGER NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderQualityReview_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OrderQualityReview_submissionId_idx" ON "OrderQualityReview"("submissionId");
CREATE INDEX IF NOT EXISTS "OrderQualityReview_reviewerId_idx" ON "OrderQualityReview"("reviewerId");

CREATE TABLE IF NOT EXISTS "OrderDeliveryEvent" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "actorId" INTEGER,
    "action" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderDeliveryEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OrderDeliveryEvent_orderId_createdAt_idx" ON "OrderDeliveryEvent"("orderId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "OrderArtisanPayoutMilestone" ADD CONSTRAINT "OrderArtisanPayoutMilestone_payoutId_fkey"
    FOREIGN KEY ("payoutId") REFERENCES "OrderArtisanPayout"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OrderArtisanPayoutTransfer" ADD CONSTRAINT "OrderArtisanPayoutTransfer_milestoneId_fkey"
    FOREIGN KEY ("milestoneId") REFERENCES "OrderArtisanPayoutMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OrderProductionProgressUpdate" ADD CONSTRAINT "OrderProductionProgressUpdate_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OrderProductionProgressEvidence" ADD CONSTRAINT "OrderProductionProgressEvidence_progressUpdateId_fkey"
    FOREIGN KEY ("progressUpdateId") REFERENCES "OrderProductionProgressUpdate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OrderProductionDeadlineExtension" ADD CONSTRAINT "OrderProductionDeadlineExtension_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OrderProductionEvent" ADD CONSTRAINT "OrderProductionEvent_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OrderProductionReminder" ADD CONSTRAINT "OrderProductionReminder_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OrderQualitySubmission" ADD CONSTRAINT "OrderQualitySubmission_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OrderQualityEvidence" ADD CONSTRAINT "OrderQualityEvidence_submissionId_fkey"
    FOREIGN KEY ("submissionId") REFERENCES "OrderQualitySubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OrderQualityReview" ADD CONSTRAINT "OrderQualityReview_submissionId_fkey"
    FOREIGN KEY ("submissionId") REFERENCES "OrderQualitySubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OrderDeliveryEvent" ADD CONSTRAINT "OrderDeliveryEvent_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
