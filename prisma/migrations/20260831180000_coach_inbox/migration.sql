-- Coach inbox: signups, Calendly bookings, Zoom join requests.

CREATE TABLE IF NOT EXISTS "CoachInboxItem" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "memberUserId" TEXT,
    "memberEmail" TEXT,
    "memberName" TEXT,
    "claimKey" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "CoachInboxItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CoachInboxItem_claimKey_key" ON "CoachInboxItem"("claimKey");
CREATE INDEX IF NOT EXISTS "CoachInboxItem_readAt_createdAt_idx" ON "CoachInboxItem"("readAt", "createdAt");
CREATE INDEX IF NOT EXISTS "CoachInboxItem_kind_createdAt_idx" ON "CoachInboxItem"("kind", "createdAt");
CREATE INDEX IF NOT EXISTS "CoachInboxItem_memberUserId_createdAt_idx" ON "CoachInboxItem"("memberUserId", "createdAt");

REVOKE ALL ON TABLE "CoachInboxItem" FROM anon, authenticated;
ALTER TABLE "CoachInboxItem" ENABLE ROW LEVEL SECURITY;
