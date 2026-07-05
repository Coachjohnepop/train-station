-- Coach Zoom OAuth tokens and pending OAuth states (replaces Vercel Blob JSON).

CREATE TABLE "CoachZoomOAuth" (
    "id" TEXT NOT NULL,
    "zoomUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL,
    "connectedByEmail" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachZoomOAuth_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ZoomOAuthPendingState" (
    "state" TEXT NOT NULL,
    "coachEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZoomOAuthPendingState_pkey" PRIMARY KEY ("state")
);

CREATE INDEX "ZoomOAuthPendingState_coachEmail_idx" ON "ZoomOAuthPendingState"("coachEmail");
CREATE INDEX "ZoomOAuthPendingState_createdAt_idx" ON "ZoomOAuthPendingState"("createdAt");