-- AlterTable
ALTER TABLE "Message" ADD COLUMN "attachmentPublicId" TEXT;
ALTER TABLE "Message" ADD COLUMN "attachmentResourceType" TEXT;
ALTER TABLE "Message" ADD COLUMN "attachmentName" TEXT;
ALTER TABLE "Message" ADD COLUMN "attachmentMimeType" TEXT;
ALTER TABLE "Message" ADD COLUMN "attachmentBytes" INTEGER;
ALTER TABLE "Message" ADD COLUMN "attachmentKind" TEXT;
ALTER TABLE "Message" ADD COLUMN "durationMs" INTEGER;
ALTER TABLE "Message" ADD COLUMN "clientKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Message_conversationId_clientKey_key" ON "Message"("conversationId", "clientKey");
