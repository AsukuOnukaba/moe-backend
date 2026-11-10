-- Soft-delete / archive for conversations (preserves messages + audit history).
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Conversation_deletedAt_idx" ON "Conversation"("deletedAt");
