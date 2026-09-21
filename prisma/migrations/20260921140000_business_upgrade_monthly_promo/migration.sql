-- CreateTable
CREATE TABLE "BusinessUpgradeMonthlyPromo" (
    "id" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "winnerUserId" TEXT,
    "winnerEmail" TEXT,
    "eligibleCount" INTEGER NOT NULL DEFAULT 0,
    "drawnAt" TIMESTAMP(3),
    "drawnBy" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessUpgradeMonthlyPromo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessUpgradeMonthlyPromo_monthKey_key" ON "BusinessUpgradeMonthlyPromo"("monthKey");

-- CreateIndex
CREATE INDEX "BusinessUpgradeMonthlyPromo_winnerUserId_idx" ON "BusinessUpgradeMonthlyPromo"("winnerUserId");
