-- Link MOE users to Clerk accounts (POST /auth/clerk-verify)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "clerkId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_clerkId_key" ON "User"("clerkId");
