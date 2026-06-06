-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "icon" TEXT,
    "isSeed" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- Seed canonical categories (isSeed=true; slug immutable for non-empty categories via API)
INSERT INTO "Category" ("id", "slug", "label", "icon", "isSeed", "sortOrder", "createdAt", "updatedAt") VALUES
  ('cat_seed_tailoring', 'tailoring', 'Tailoring', 'Scissors', true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_seed_arts_and_crafts', 'arts_and_crafts', 'Arts & Crafts', 'Palette', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_seed_shoemaking', 'shoemaking', 'Shoemaking', 'Footprints', true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_seed_beauty', 'beauty', 'Beauty', 'Sparkles', true, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_seed_leatherwork', 'leatherwork', 'Leatherwork', 'Briefcase', true, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_seed_jewellery', 'jewellery', 'Jewellery', 'Gem', true, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_seed_home_and_decor', 'home_and_decor', 'Home & Decor', 'Home', true, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
