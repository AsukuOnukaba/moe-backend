-- Phase 2 Batch 1B: initial artisan payout + production start fields

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "adminCapabilities" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "productionStartedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "productionDeadline" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "productionStartedById" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "productionDurationDays" INTEGER;

CREATE INDEX IF NOT EXISTS "Order_productionStartedAt_idx" ON "Order"("productionStartedAt");

CREATE TABLE IF NOT EXISTS "OrderArtisanPayout" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "assessmentId" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "requestedAmount" DOUBLE PRECISION,
    "approvedAmount" DOUBLE PRECISION,
    "amountApprovedById" INTEGER,
    "amountApprovedAt" TIMESTAMP(3),
    "amountApprovalReason" TEXT,
    "exceptionApproved" BOOLEAN NOT NULL DEFAULT false,
    "exceptionReason" TEXT,
    "limitPolicyStatus" TEXT,
    "fundingRequired" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "disputeFlag" BOOLEAN NOT NULL DEFAULT false,
    "disputeNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderArtisanPayout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrderArtisanPayout_orderId_key" ON "OrderArtisanPayout"("orderId");
CREATE INDEX IF NOT EXISTS "OrderArtisanPayout_status_idx" ON "OrderArtisanPayout"("status");
CREATE INDEX IF NOT EXISTS "OrderArtisanPayout_assessmentId_idx" ON "OrderArtisanPayout"("assessmentId");

CREATE TABLE IF NOT EXISTS "OrderArtisanPayoutTransfer" (
    "id" SERIAL NOT NULL,
    "payoutId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "transferDate" TIMESTAMP(3) NOT NULL,
    "payeeName" TEXT NOT NULL,
    "payeeDetails" TEXT,
    "externalReference" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'recorded',
    "recordedById" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedById" INTEGER,
    "verifiedAt" TIMESTAMP(3),
    "verificationNotes" TEXT,
    "rejectionReason" TEXT,

    CONSTRAINT "OrderArtisanPayoutTransfer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrderArtisanPayoutTransfer_externalReference_key" ON "OrderArtisanPayoutTransfer"("externalReference");
CREATE INDEX IF NOT EXISTS "OrderArtisanPayoutTransfer_payoutId_status_idx" ON "OrderArtisanPayoutTransfer"("payoutId", "status");
CREATE INDEX IF NOT EXISTS "OrderArtisanPayoutTransfer_recordedById_idx" ON "OrderArtisanPayoutTransfer"("recordedById");

CREATE TABLE IF NOT EXISTS "OrderArtisanPayoutEvidence" (
    "id" SERIAL NOT NULL,
    "transferId" INTEGER NOT NULL,
    "attachmentPublicId" TEXT NOT NULL,
    "attachmentResourceType" TEXT NOT NULL,
    "attachmentName" TEXT NOT NULL,
    "attachmentMimeType" TEXT NOT NULL,
    "attachmentBytes" INTEGER,
    "attachmentKind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderArtisanPayoutEvidence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OrderArtisanPayoutEvidence_transferId_idx" ON "OrderArtisanPayoutEvidence"("transferId");

CREATE TABLE IF NOT EXISTS "OrderArtisanPayoutEvent" (
    "id" SERIAL NOT NULL,
    "payoutId" INTEGER NOT NULL,
    "orderId" INTEGER NOT NULL,
    "actorId" INTEGER,
    "action" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderArtisanPayoutEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OrderArtisanPayoutEvent_payoutId_createdAt_idx" ON "OrderArtisanPayoutEvent"("payoutId", "createdAt");
CREATE INDEX IF NOT EXISTS "OrderArtisanPayoutEvent_orderId_createdAt_idx" ON "OrderArtisanPayoutEvent"("orderId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "OrderArtisanPayout" ADD CONSTRAINT "OrderArtisanPayout_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OrderArtisanPayout" ADD CONSTRAINT "OrderArtisanPayout_assessmentId_fkey"
    FOREIGN KEY ("assessmentId") REFERENCES "OrderReadinessAssessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OrderArtisanPayoutTransfer" ADD CONSTRAINT "OrderArtisanPayoutTransfer_payoutId_fkey"
    FOREIGN KEY ("payoutId") REFERENCES "OrderArtisanPayout"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OrderArtisanPayoutEvidence" ADD CONSTRAINT "OrderArtisanPayoutEvidence_transferId_fkey"
    FOREIGN KEY ("transferId") REFERENCES "OrderArtisanPayoutTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OrderArtisanPayoutEvent" ADD CONSTRAINT "OrderArtisanPayoutEvent_payoutId_fkey"
    FOREIGN KEY ("payoutId") REFERENCES "OrderArtisanPayout"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
