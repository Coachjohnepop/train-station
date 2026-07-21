-- Durable live-class Zoom room per business day (instant member Join after coach start).
CREATE TABLE IF NOT EXISTS "LiveClassZoomDay" (
    "sessionDate" TEXT NOT NULL,
    "record" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveClassZoomDay_pkey" PRIMARY KEY ("sessionDate")
);
