CREATE TABLE IF NOT EXISTS "FoodEntry" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "eatenOn" TEXT NOT NULL,
  "protein" TEXT NOT NULL DEFAULT '',
  "starch" TEXT NOT NULL DEFAULT '',
  "fat" TEXT NOT NULL DEFAULT '',
  "extras" TEXT NOT NULL DEFAULT '',
  "calories" INTEGER NOT NULL,
  "proteinG" INTEGER,
  "carbG" INTEGER,
  "fatG" INTEGER,
  "source" TEXT NOT NULL DEFAULT 'manual',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FoodEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FoodEntry_userId_eatenOn_idx" ON "FoodEntry"("userId", "eatenOn");

DO $$ BEGIN
  ALTER TABLE "FoodEntry"
    ADD CONSTRAINT "FoodEntry_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
