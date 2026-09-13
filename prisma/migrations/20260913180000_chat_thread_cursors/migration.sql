-- Per-member clear-messages cursor (live vs Archive).

CREATE TABLE "ChatThreadCursor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "clearedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatThreadCursor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChatThreadCursor_userId_threadId_key" ON "ChatThreadCursor"("userId", "threadId");
CREATE INDEX "ChatThreadCursor_userId_idx" ON "ChatThreadCursor"("userId");

ALTER TABLE "ChatThreadCursor" ADD CONSTRAINT "ChatThreadCursor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
