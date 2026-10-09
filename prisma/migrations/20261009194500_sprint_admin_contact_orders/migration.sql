-- ContactMessage
CREATE TABLE "ContactMessage" (
    "id" SERIAL NOT NULL,
    "senderName" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "subject" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'contact_us',

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContactMessage_source_createdAt_idx" ON "ContactMessage"("source", "createdAt");
CREATE INDEX "ContactMessage_isRead_idx" ON "ContactMessage"("isRead");

-- Order estimated delivery snapshot + status history
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "estimatedDelivery" TEXT;

CREATE TABLE "OrderStatusHistory" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "changedBy" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderStatusHistory_orderId_idx" ON "OrderStatusHistory"("orderId");
CREATE INDEX "OrderStatusHistory_orderId_createdAt_idx" ON "OrderStatusHistory"("orderId", "createdAt");

ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Artisan verification documents
CREATE TABLE "ArtisanVerificationDocument" (
    "id" SERIAL NOT NULL,
    "artisanId" INTEGER NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtisanVerificationDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ArtisanVerificationDocument_artisanId_idx" ON "ArtisanVerificationDocument"("artisanId");

ALTER TABLE "ArtisanVerificationDocument" ADD CONSTRAINT "ArtisanVerificationDocument_artisanId_fkey" FOREIGN KEY ("artisanId") REFERENCES "ArtisanProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
