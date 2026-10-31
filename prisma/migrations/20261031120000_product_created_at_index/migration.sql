-- Speeds up admin date filters and newest/oldest sorting on large catalogues.
CREATE INDEX IF NOT EXISTS "Product_createdAt_idx" ON "Product"("createdAt");
