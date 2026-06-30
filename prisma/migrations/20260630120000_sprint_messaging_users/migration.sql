-- AlterTable
ALTER TABLE "User" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "artisanNote" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'unread';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN "senderRole" TEXT NOT NULL DEFAULT 'customer';

-- Backfill senderRole from senderType
UPDATE "Message" SET "senderRole" = 'customer' WHERE "senderType" = 'customer';
UPDATE "Message" SET "senderRole" = 'admin' WHERE "senderType" = 'provider';
