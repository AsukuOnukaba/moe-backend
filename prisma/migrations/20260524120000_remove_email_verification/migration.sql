-- AlterTable
ALTER TABLE "User" DROP COLUMN IF EXISTS "emailVerified",
DROP COLUMN IF EXISTS "requiresEmailVerification",
DROP COLUMN IF EXISTS "emailOtp",
DROP COLUMN IF EXISTS "emailOtpExpiresAt",
DROP COLUMN IF EXISTS "adminOtp",
DROP COLUMN IF EXISTS "adminOtpExpiresAt";
