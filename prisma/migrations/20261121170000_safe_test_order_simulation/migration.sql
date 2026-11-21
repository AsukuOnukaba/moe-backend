ALTER TABLE "User"
  ADD COLUMN "isTestUser" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Order"
  ADD COLUMN "isTestOrder" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "testReference" TEXT,
  ADD COLUMN "simulatedPaymentStatus" TEXT,
  ADD COLUMN "simulationTimeScenario" TEXT;

ALTER TABLE "OrderArtisanPayout"
  ADD COLUMN "isSimulated" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "OrderArtisanPayoutTransfer"
  ADD COLUMN "isSimulated" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "PaymentAttempt"
  ADD COLUMN "isSimulated" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "SimulatedPaymentSettlement" (
  "id" TEXT NOT NULL,
  "orderId" INTEGER NOT NULL,
  "customerId" INTEGER NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'succeeded',
  "createdById" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SimulatedPaymentSettlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Order_testReference_key" ON "Order"("testReference");
CREATE INDEX "Order_isTestOrder_createdAt_idx" ON "Order"("isTestOrder", "createdAt");
CREATE UNIQUE INDEX "SimulatedPaymentSettlement_orderId_key"
  ON "SimulatedPaymentSettlement"("orderId");
CREATE INDEX "SimulatedPaymentSettlement_customerId_createdAt_idx"
  ON "SimulatedPaymentSettlement"("customerId", "createdAt");
CREATE INDEX "SimulatedPaymentSettlement_createdById_createdAt_idx"
  ON "SimulatedPaymentSettlement"("createdById", "createdAt");

ALTER TABLE "SimulatedPaymentSettlement"
  ADD CONSTRAINT "SimulatedPaymentSettlement_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
