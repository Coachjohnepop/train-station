-- QuickBooks-style double-entry accounting framework

CREATE TYPE "AcctAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');
CREATE TYPE "AcctNormalBalance" AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE "AcctJournalStatus" AS ENUM ('DRAFT', 'POSTED', 'VOID');
CREATE TYPE "AcctPartyKind" AS ENUM ('CUSTOMER', 'VENDOR', 'PARTNER', 'OTHER');
CREATE TYPE "AcctSourceSystem" AS ENUM ('STRIPE', 'VENMO', 'MANUAL', 'COMMISSION', 'SYSTEM', 'IMPORT');

CREATE TABLE "AcctEntity" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcctEntity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AcctEntity_code_key" ON "AcctEntity"("code");

CREATE TABLE "AcctAccount" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AcctAccountType" NOT NULL,
    "subtype" TEXT,
    "normalBalance" "AcctNormalBalance" NOT NULL,
    "parentId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcctAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AcctAccount_entityId_code_key" ON "AcctAccount"("entityId", "code");
CREATE INDEX "AcctAccount_entityId_type_idx" ON "AcctAccount"("entityId", "type");
CREATE INDEX "AcctAccount_entityId_isActive_idx" ON "AcctAccount"("entityId", "isActive");

CREATE TABLE "AcctParty" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "kind" "AcctPartyKind" NOT NULL DEFAULT 'CUSTOMER',
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "userId" TEXT,
    "stripeCustomerId" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcctParty_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AcctParty_entityId_kind_idx" ON "AcctParty"("entityId", "kind");
CREATE INDEX "AcctParty_userId_idx" ON "AcctParty"("userId");
CREATE INDEX "AcctParty_email_idx" ON "AcctParty"("email");
CREATE INDEX "AcctParty_stripeCustomerId_idx" ON "AcctParty"("stripeCustomerId");

CREATE TABLE "AcctPeriod" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcctPeriod_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AcctPeriod_entityId_label_key" ON "AcctPeriod"("entityId", "label");
CREATE INDEX "AcctPeriod_entityId_startsOn_endsOn_idx" ON "AcctPeriod"("entityId", "startsOn", "endsOn");

CREATE TABLE "AcctJournalEntry" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entryNumber" TEXT NOT NULL,
    "entryDate" DATE NOT NULL,
    "status" "AcctJournalStatus" NOT NULL DEFAULT 'DRAFT',
    "memo" TEXT,
    "sourceSystem" "AcctSourceSystem" NOT NULL DEFAULT 'SYSTEM',
    "sourceType" TEXT,
    "sourceId" TEXT,
    "periodId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "postedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcctJournalEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AcctJournalEntry_entityId_entryNumber_key" ON "AcctJournalEntry"("entityId", "entryNumber");
CREATE UNIQUE INDEX "AcctJournalEntry_sourceSystem_sourceType_sourceId_key" ON "AcctJournalEntry"("sourceSystem", "sourceType", "sourceId");
CREATE INDEX "AcctJournalEntry_entityId_entryDate_idx" ON "AcctJournalEntry"("entityId", "entryDate");
CREATE INDEX "AcctJournalEntry_entityId_status_entryDate_idx" ON "AcctJournalEntry"("entityId", "status", "entryDate");
CREATE INDEX "AcctJournalEntry_sourceType_sourceId_idx" ON "AcctJournalEntry"("sourceType", "sourceId");

CREATE TABLE "AcctJournalLine" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "partyId" TEXT,
    "lineNo" INTEGER NOT NULL DEFAULT 0,
    "debitCents" INTEGER NOT NULL DEFAULT 0,
    "creditCents" INTEGER NOT NULL DEFAULT 0,
    "memo" TEXT,
    "dimensions" JSONB,

    CONSTRAINT "AcctJournalLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AcctJournalLine_entryId_lineNo_idx" ON "AcctJournalLine"("entryId", "lineNo");
CREATE INDEX "AcctJournalLine_accountId_idx" ON "AcctJournalLine"("accountId");
CREATE INDEX "AcctJournalLine_partyId_idx" ON "AcctJournalLine"("partyId");

ALTER TABLE "AcctAccount" ADD CONSTRAINT "AcctAccount_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "AcctEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcctAccount" ADD CONSTRAINT "AcctAccount_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AcctAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AcctParty" ADD CONSTRAINT "AcctParty_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "AcctEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcctParty" ADD CONSTRAINT "AcctParty_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AcctPeriod" ADD CONSTRAINT "AcctPeriod_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "AcctEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AcctJournalEntry" ADD CONSTRAINT "AcctJournalEntry_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "AcctEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcctJournalEntry" ADD CONSTRAINT "AcctJournalEntry_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AcctPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AcctJournalEntry" ADD CONSTRAINT "AcctJournalEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AcctJournalLine" ADD CONSTRAINT "AcctJournalLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "AcctJournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcctJournalLine" ADD CONSTRAINT "AcctJournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AcctAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AcctJournalLine" ADD CONSTRAINT "AcctJournalLine_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "AcctParty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
