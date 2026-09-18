-- Monthly platform-fee lines + leftover split for Stripe money desk

CREATE TABLE "MoneyDeskSettings" (
    "id" TEXT NOT NULL,
    "grokCents" INTEGER NOT NULL DEFAULT 3000,
    "vercelCents" INTEGER NOT NULL DEFAULT 2000,
    "supabaseCents" INTEGER NOT NULL DEFAULT 3500,
    "refundBufferCents" INTEGER NOT NULL DEFAULT 5000,
    "reinvestPercent" INTEGER NOT NULL DEFAULT 100,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "MoneyDeskSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "MoneyDeskSettings" (
    "id",
    "grokCents",
    "vercelCents",
    "supabaseCents",
    "refundBufferCents",
    "reinvestPercent",
    "updatedAt"
) VALUES (
    'default',
    3000,
    2000,
    3500,
    5000,
    100,
    CURRENT_TIMESTAMP
);
