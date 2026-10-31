-- Existing accounts stay verified. New email/password signups set emailVerified = false.
ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "emailVerificationTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN "emailVerificationExpires" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "emailVerificationConsumedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "emailVerificationSentAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_emailVerificationTokenHash_key" ON "User"("emailVerificationTokenHash");
