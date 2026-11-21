-- Public artisan profile links (all optional for backward compatibility).
ALTER TABLE "ArtisanProfile"
  ADD COLUMN "websiteUrl" TEXT,
  ADD COLUMN "instagramUrl" TEXT,
  ADD COLUMN "facebookUrl" TEXT,
  ADD COLUMN "xUrl" TEXT,
  ADD COLUMN "linkedinUrl" TEXT;

-- Extend the existing support ticket record with order-specific complaint data.
ALTER TABLE "ContactMessage"
  ADD COLUMN "submittedById" INTEGER,
  ADD COLUMN "orderId" INTEGER,
  ADD COLUMN "category" TEXT,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "SupportTicketAttachment" (
  "id" SERIAL NOT NULL,
  "ticketId" INTEGER NOT NULL,
  "attachmentPublicId" TEXT NOT NULL,
  "attachmentResourceType" TEXT NOT NULL,
  "attachmentName" TEXT NOT NULL,
  "attachmentMimeType" TEXT NOT NULL,
  "attachmentBytes" INTEGER,
  "attachmentKind" TEXT NOT NULL,
  "durationMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportTicketAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportTicketEvent" (
  "id" SERIAL NOT NULL,
  "ticketId" INTEGER NOT NULL,
  "actorId" INTEGER,
  "status" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportTicketEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContactMessage_submittedById_createdAt_idx"
  ON "ContactMessage"("submittedById", "createdAt");
CREATE INDEX "ContactMessage_orderId_createdAt_idx"
  ON "ContactMessage"("orderId", "createdAt");
CREATE INDEX "ContactMessage_status_idx" ON "ContactMessage"("status");
CREATE INDEX "SupportTicketAttachment_ticketId_idx"
  ON "SupportTicketAttachment"("ticketId");
CREATE INDEX "SupportTicketEvent_ticketId_createdAt_idx"
  ON "SupportTicketEvent"("ticketId", "createdAt");

ALTER TABLE "ContactMessage"
  ADD CONSTRAINT "ContactMessage_submittedById_fkey"
  FOREIGN KEY ("submittedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContactMessage"
  ADD CONSTRAINT "ContactMessage_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportTicketAttachment"
  ADD CONSTRAINT "SupportTicketAttachment_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "ContactMessage"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportTicketEvent"
  ADD CONSTRAINT "SupportTicketEvent_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "ContactMessage"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
