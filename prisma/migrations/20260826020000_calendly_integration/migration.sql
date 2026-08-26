-- Calendly PAT + webhook signing key (Admin → Bookings can paste; env still wins).
CREATE TABLE IF NOT EXISTS "CalendlyIntegration" (
    "id" TEXT NOT NULL,
    "apiToken" TEXT NOT NULL,
    "webhookSigningKey" TEXT,
    "webhookUri" TEXT,
    "connectedEmail" TEXT,
    "connectedName" TEXT,
    "connectedAt" TIMESTAMP(3),
    "connectedByEmail" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendlyIntegration_pkey" PRIMARY KEY ("id")
);
