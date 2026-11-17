-- AlterTable
ALTER TABLE "Order" ADD COLUMN "readinessAssignedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "readinessResponseDeadline" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "readinessDeadlineExtendedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "readinessExtensionHours" INTEGER;
ALTER TABLE "Order" ADD COLUMN "readinessExtensionReason" TEXT;
ALTER TABLE "Order" ADD COLUMN "readinessExtensionById" INTEGER;
ALTER TABLE "Order" ADD COLUMN "readinessWorkflowStatus" TEXT;
ALTER TABLE "Order" ADD COLUMN "highValueOverride" BOOLEAN;

-- CreateIndex
CREATE INDEX "Order_readinessWorkflowStatus_idx" ON "Order"("readinessWorkflowStatus");
CREATE INDEX "Order_readinessResponseDeadline_idx" ON "Order"("readinessResponseDeadline");

-- CreateTable
CREATE TABLE "OrderReadinessAssessment" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "artisanId" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "cannotFulfil" BOOLEAN NOT NULL DEFAULT false,
    "cannotFulfilReason" TEXT,
    "acknowledgedRequirements" BOOLEAN NOT NULL DEFAULT false,
    "reviewedRequirementsAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderReadinessAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderReadinessEvidence" (
    "id" SERIAL NOT NULL,
    "assessmentId" INTEGER NOT NULL,
    "attachmentPublicId" TEXT NOT NULL,
    "attachmentResourceType" TEXT NOT NULL,
    "attachmentName" TEXT NOT NULL,
    "attachmentMimeType" TEXT NOT NULL,
    "attachmentBytes" INTEGER,
    "attachmentKind" TEXT NOT NULL,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderReadinessEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderReadinessReview" (
    "id" SERIAL NOT NULL,
    "assessmentId" INTEGER NOT NULL,
    "reviewerId" INTEGER NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderReadinessReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderReadinessReminder" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderReadinessReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderReadinessEvent" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "actorId" INTEGER,
    "action" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderReadinessEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderReadinessAssessment_orderId_version_key" ON "OrderReadinessAssessment"("orderId", "version");
CREATE INDEX "OrderReadinessAssessment_orderId_status_idx" ON "OrderReadinessAssessment"("orderId", "status");
CREATE INDEX "OrderReadinessAssessment_artisanId_idx" ON "OrderReadinessAssessment"("artisanId");
CREATE INDEX "OrderReadinessEvidence_assessmentId_idx" ON "OrderReadinessEvidence"("assessmentId");
CREATE INDEX "OrderReadinessReview_assessmentId_idx" ON "OrderReadinessReview"("assessmentId");
CREATE INDEX "OrderReadinessReview_reviewerId_idx" ON "OrderReadinessReview"("reviewerId");
CREATE UNIQUE INDEX "OrderReadinessReminder_orderId_kind_key" ON "OrderReadinessReminder"("orderId", "kind");
CREATE INDEX "OrderReadinessReminder_orderId_idx" ON "OrderReadinessReminder"("orderId");
CREATE INDEX "OrderReadinessEvent_orderId_createdAt_idx" ON "OrderReadinessEvent"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "OrderReadinessAssessment" ADD CONSTRAINT "OrderReadinessAssessment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderReadinessEvidence" ADD CONSTRAINT "OrderReadinessEvidence_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "OrderReadinessAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderReadinessReview" ADD CONSTRAINT "OrderReadinessReview_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "OrderReadinessAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderReadinessReminder" ADD CONSTRAINT "OrderReadinessReminder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderReadinessEvent" ADD CONSTRAINT "OrderReadinessEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
