-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "orderId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "gateway" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paymentUrl" TEXT,
    "accessCode" TEXT,
    "saveCard" BOOLEAN NOT NULL DEFAULT false,
    "cardOnly" BOOLEAN NOT NULL DEFAULT false,
    "providerStatus" TEXT,
    "failureReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWebhookEvent" (
    "id" TEXT NOT NULL,
    "gateway" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_reference_key" ON "PaymentAttempt"("reference");

-- CreateIndex
CREATE INDEX "PaymentAttempt_orderId_gateway_status_idx" ON "PaymentAttempt"("orderId", "gateway", "status");

-- CreateIndex
CREATE INDEX "PaymentAttempt_customerId_idx" ON "PaymentAttempt"("customerId");

-- One open checkout per order and gateway so a double click cannot start two charges.
CREATE UNIQUE INDEX "PaymentAttempt_one_pending_per_order_gateway"
ON "PaymentAttempt"("orderId", "gateway")
WHERE "status" = 'pending';

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookEvent_gateway_eventKey_key" ON "PaymentWebhookEvent"("gateway", "eventKey");

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
