-- One username column for every account. Case-insensitive uniqueness.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User" ("username");

CREATE UNIQUE INDEX IF NOT EXISTS "User_username_lower_idx" ON "User" (lower("username"));

-- Try-without-email handles were stored in name. Copy those, not real full names.
WITH ranked AS (
  SELECT
    id,
    btrim(name) AS handle,
    row_number() OVER (
      PARTITION BY lower(btrim(name))
      ORDER BY "createdAt" ASC, id ASC
    ) AS n
  FROM "User"
  WHERE name IS NOT NULL
    AND btrim(name) ~ '^[A-Za-z][A-Za-z0-9_]{2,23}$'
)
UPDATE "User" AS u
SET username = r.handle
FROM ranked AS r
WHERE u.id = r.id
  AND r.n = 1
  AND u.username IS NULL;
