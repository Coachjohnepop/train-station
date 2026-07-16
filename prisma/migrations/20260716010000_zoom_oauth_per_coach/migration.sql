-- Per-coach Zoom OAuth: rekey singleton id = 'coach' → lower(connectedByEmail)

-- Prefer connectedByEmail; fall back to Zoom profile email if needed
UPDATE "CoachZoomOAuth"
SET
  "id" = lower(trim(COALESCE(NULLIF(trim("connectedByEmail"), ''), NULLIF(trim("email"), ''), 'coach'))),
  "connectedByEmail" = lower(trim(COALESCE(NULLIF(trim("connectedByEmail"), ''), NULLIF(trim("email"), ''), 'coach')))
WHERE "id" = 'coach';

-- Normalize any other rows
UPDATE "CoachZoomOAuth"
SET
  "id" = lower(trim("connectedByEmail")),
  "connectedByEmail" = lower(trim("connectedByEmail"))
WHERE "connectedByEmail" IS NOT NULL
  AND trim("connectedByEmail") <> ''
  AND "id" <> lower(trim("connectedByEmail"));

CREATE INDEX IF NOT EXISTS "CoachZoomOAuth_email_idx" ON "CoachZoomOAuth"("email");
CREATE INDEX IF NOT EXISTS "CoachZoomOAuth_connectedByEmail_idx" ON "CoachZoomOAuth"("connectedByEmail");
