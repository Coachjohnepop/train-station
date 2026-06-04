/*
  Warnings:

  - Added the required column `slug` to the `Program` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Program" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tierSlug" TEXT NOT NULL DEFAULT 'starter',
    "category" TEXT,
    "durationWeeks" INTEGER NOT NULL DEFAULT 4,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "coverUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Program" ("category", "coverUrl", "createdAt", "description", "durationWeeks", "id", "name", "published", "tierSlug", "updatedAt") SELECT "category", "coverUrl", "createdAt", "description", "durationWeeks", "id", "name", "published", "tierSlug", "updatedAt" FROM "Program";
DROP TABLE "Program";
ALTER TABLE "new_Program" RENAME TO "Program";
CREATE UNIQUE INDEX "Program_slug_key" ON "Program"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
