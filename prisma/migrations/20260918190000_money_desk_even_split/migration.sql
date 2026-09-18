-- Four-way split of visible cash (25% each for now)

ALTER TABLE "MoneyDeskSettings"
ADD COLUMN "platformFeesPercent" INTEGER NOT NULL DEFAULT 25,
ADD COLUMN "johnPayPercent" INTEGER NOT NULL DEFAULT 25,
ADD COLUMN "jeremyPayPercent" INTEGER NOT NULL DEFAULT 25;

UPDATE "MoneyDeskSettings"
SET
  "platformFeesPercent" = 25,
  "johnPayPercent" = 25,
  "reinvestPercent" = 25,
  "jeremyPayPercent" = 25;
