CREATE TABLE IF NOT EXISTS "ActivityEntry" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "loggedOn" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ActivityEntry_userId_loggedOn_idx" ON "ActivityEntry"("userId", "loggedOn");

DO $$ BEGIN
  ALTER TABLE "ActivityEntry"
    ADD CONSTRAINT "ActivityEntry_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
