-- Multi-part program days (military double/triple days, etc.)
-- ProgramDay = calendar day
-- ProgramDaySession = ordered part (AM / midday / PM)
-- ProgramDayOption = Gym/Home track under a session

-- 1) Session container
CREATE TABLE IF NOT EXISTS "ProgramDaySession" (
  "id" TEXT NOT NULL,
  "dayId" TEXT NOT NULL,
  "partIndex" INTEGER NOT NULL,
  "label" TEXT NOT NULL,
  "sessionKind" TEXT NOT NULL DEFAULT 'strength',
  "timeSlot" TEXT,
  "notes" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProgramDaySession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProgramDaySession_dayId_partIndex_key"
  ON "ProgramDaySession"("dayId", "partIndex");
CREATE INDEX IF NOT EXISTS "ProgramDaySession_dayId_sortOrder_idx"
  ON "ProgramDaySession"("dayId", "sortOrder");
CREATE INDEX IF NOT EXISTS "ProgramDaySession_sessionKind_idx"
  ON "ProgramDaySession"("sessionKind");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProgramDaySession_dayId_fkey'
  ) THEN
    ALTER TABLE "ProgramDaySession"
      ADD CONSTRAINT "ProgramDaySession_dayId_fkey"
      FOREIGN KEY ("dayId") REFERENCES "ProgramDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 2) Day-level part count (1 = normal single session)
ALTER TABLE "ProgramDay" ADD COLUMN IF NOT EXISTS "partCount" INTEGER NOT NULL DEFAULT 1;

-- 3) Option → session link (nullable during backfill)
ALTER TABLE "ProgramDayOption" ADD COLUMN IF NOT EXISTS "sessionId" TEXT;

CREATE INDEX IF NOT EXISTS "ProgramDayOption_sessionId_idx"
  ON "ProgramDayOption"("sessionId");
CREATE INDEX IF NOT EXISTS "ProgramDayOption_dayId_sessionId_idx"
  ON "ProgramDayOption"("dayId", "sessionId");

-- 4) Backfill: every existing day gets one Main session; options attach to it
INSERT INTO "ProgramDaySession" ("id", "dayId", "partIndex", "label", "sessionKind", "timeSlot", "notes", "sortOrder", "createdAt", "updatedAt")
SELECT
  'pds_' || d."id",
  d."id",
  1,
  'Main',
  'strength',
  NULL,
  NULL,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "ProgramDay" d
WHERE NOT EXISTS (
  SELECT 1 FROM "ProgramDaySession" s WHERE s."dayId" = d."id" AND s."partIndex" = 1
);

UPDATE "ProgramDayOption" o
SET "sessionId" = 'pds_' || o."dayId"
WHERE o."sessionId" IS NULL
  AND EXISTS (SELECT 1 FROM "ProgramDaySession" s WHERE s."id" = 'pds_' || o."dayId");

-- 5) FK for sessionId (safe if already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProgramDayOption_sessionId_fkey'
  ) THEN
    ALTER TABLE "ProgramDayOption"
      ADD CONSTRAINT "ProgramDayOption_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "ProgramDaySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
