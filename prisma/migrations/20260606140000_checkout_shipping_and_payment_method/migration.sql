-- AlterTable
ALTER TABLE "Order" ADD COLUMN "shippingAddress" JSONB;
ALTER TABLE "Order" ADD COLUMN "paymentMethodId" TEXT;
