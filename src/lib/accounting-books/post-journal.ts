import "server-only";

import type { AcctSourceSystem, Prisma } from "@/generated/prisma/client";
import { isDatabaseConfigured } from "@/lib/database-config";
import { isDemoMode } from "@/lib/demo-enrollments";
import { ensureAccountingBooks } from "@/lib/accounting-books/ensure-books";
import { ACCT } from "@/lib/accounting-books/chart-of-accounts";

export type JournalLineInput = {
  accountCode: string;
  debitCents?: number;
  creditCents?: number;
  memo?: string;
  partyId?: string | null;
  dimensions?: Record<string, unknown>;
};

export type PostJournalInput = {
  entryDate: Date;
  memo: string;
  sourceSystem: AcctSourceSystem;
  sourceType: string;
  sourceId: string;
  currency?: string;
  lines: JournalLineInput[];
  createdByUserId?: string | null;
  status?: "DRAFT" | "POSTED";
};

function assertBalanced(lines: JournalLineInput[]) {
  let debits = 0;
  let credits = 0;
  for (const line of lines) {
    const d = Math.max(0, Math.floor(line.debitCents || 0));
    const c = Math.max(0, Math.floor(line.creditCents || 0));
    if (d > 0 && c > 0) {
      throw new Error("Journal line cannot have both debit and credit.");
    }
    if (d === 0 && c === 0) {
      throw new Error("Journal line needs a debit or credit.");
    }
    debits += d;
    credits += c;
  }
  if (debits !== credits) {
    throw new Error(`Unbalanced journal: debits ${debits} ≠ credits ${credits}`);
  }
  if (debits <= 0) {
    throw new Error("Journal has zero amount.");
  }
}

async function nextEntryNumber(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: { acctJournalEntry: { count: (args: any) => Promise<number> } },
  entityId: string,
): Promise<string> {
  const count = await client.acctJournalEntry.count({ where: { entityId } });
  return `JE-${String(count + 1).padStart(5, "0")}`;
}

/**
 * Idempotent journal post by (sourceSystem, sourceType, sourceId).
 * Returns existing entry if already posted.
 */
export async function postJournalEntry(
  input: PostJournalInput,
): Promise<{ id: string; entryNumber: string; created: boolean } | null> {
  if (!isDatabaseConfigured() || isDemoMode()) return null;
  if (!input.sourceType || !input.sourceId) {
    throw new Error("sourceType and sourceId are required for idempotent posting.");
  }
  assertBalanced(input.lines);

  const books = await ensureAccountingBooks();
  if (!books) return null;

  const { prisma } = await import("@/lib/prisma");

  const existing = await prisma.acctJournalEntry.findFirst({
    where: {
      sourceSystem: input.sourceSystem,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    },
    select: { id: true, entryNumber: true },
  });
  if (existing) {
    return { id: existing.id, entryNumber: existing.entryNumber, created: false };
  }

  const accounts = await prisma.acctAccount.findMany({
    where: {
      entityId: books.entityId,
      code: { in: input.lines.map((l) => l.accountCode) },
    },
  });
  const byCode = new Map(accounts.map((a) => [a.code, a]));
  for (const line of input.lines) {
    if (!byCode.has(line.accountCode)) {
      throw new Error(`Unknown account code ${line.accountCode}. Run ensureAccountingBooks.`);
    }
  }

  const status = input.status ?? "POSTED";
  const now = new Date();
  const entryDate = input.entryDate;

  const entry = await prisma.$transaction(async (tx) => {
    const entryNumber = await nextEntryNumber(tx, books.entityId);
    return tx.acctJournalEntry.create({
      data: {
        entityId: books.entityId,
        entryNumber,
        entryDate,
        status,
        memo: input.memo,
        sourceSystem: input.sourceSystem,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        currency: input.currency ?? "usd",
        postedAt: status === "POSTED" ? now : null,
        createdByUserId: input.createdByUserId ?? null,
        updatedAt: now,
        lines: {
          create: input.lines.map((line, i) => ({
            accountId: byCode.get(line.accountCode)!.id,
            partyId: line.partyId ?? null,
            lineNo: i + 1,
            debitCents: Math.max(0, Math.floor(line.debitCents || 0)),
            creditCents: Math.max(0, Math.floor(line.creditCents || 0)),
            memo: line.memo ?? null,
            dimensions: (line.dimensions ?? undefined) as Prisma.InputJsonValue | undefined,
          })),
        },
      },
      select: { id: true, entryNumber: true },
    });
  });

  return { id: entry.id, entryNumber: entry.entryNumber, created: true };
}

/** Ensure customer party for a member (by userId). */
export async function ensureCustomerParty(input: {
  userId: string;
  name: string;
  email?: string | null;
  stripeCustomerId?: string | null;
}): Promise<string | null> {
  if (!isDatabaseConfigured() || isDemoMode()) return null;
  const books = await ensureAccountingBooks();
  if (!books) return null;

  const { prisma } = await import("@/lib/prisma");
  const existing = await prisma.acctParty.findFirst({
    where: { entityId: books.entityId, userId: input.userId, kind: "CUSTOMER" },
  });
  if (existing) {
    if (
      (input.stripeCustomerId && existing.stripeCustomerId !== input.stripeCustomerId) ||
      (input.email && existing.email !== input.email)
    ) {
      await prisma.acctParty.update({
        where: { id: existing.id },
        data: {
          stripeCustomerId: input.stripeCustomerId ?? existing.stripeCustomerId,
          email: input.email ?? existing.email,
          name: input.name || existing.name,
          updatedAt: new Date(),
        },
      });
    }
    return existing.id;
  }

  const created = await prisma.acctParty.create({
    data: {
      entityId: books.entityId,
      kind: "CUSTOMER",
      name: input.name || input.email || input.userId,
      email: input.email ?? null,
      userId: input.userId,
      stripeCustomerId: input.stripeCustomerId ?? null,
      updatedAt: new Date(),
    },
  });
  return created.id;
}

/**
 * Post a membership / mark-paid / tip cash receipt into the GL.
 * Dr cash · Cr revenue (balanced).
 */
export async function postMembershipCashReceipt(input: {
  factId: string;
  userId?: string | null;
  amountCents: number;
  currency?: string;
  paidAt: Date;
  planId?: string | null;
  billingReason?: string | null;
  method?: string | null;
  memberName?: string | null;
  memberEmail?: string | null;
  stripeCustomerId?: string | null;
}): Promise<{ id: string; entryNumber: string; created: boolean } | null> {
  if (input.amountCents <= 0) return null;

  const reason = (input.billingReason || "").toLowerCase();
  const method = (input.method || "").toLowerCase();
  const isTip = reason.includes("tip") || input.planId === "coach_tip";
  const isVenmo =
    method === "venmo" || reason.includes("venmo") || reason === "venmo_manual";
  const isManual = method === "manual" || reason.includes("admin_mark") || reason === "admin_mark_paid";

  let cashCode: string = ACCT.CASH_STRIPE;
  let sourceSystem: AcctSourceSystem = "STRIPE";
  if (isVenmo) {
    cashCode = ACCT.CASH_VENMO;
    sourceSystem = "VENMO";
  } else if (isManual && !isTip) {
    cashCode = ACCT.CASH_VENMO;
    sourceSystem = "MANUAL";
  }

  let revenueCode: string = ACCT.MEMBERSHIP_REV;
  if (isTip) revenueCode = ACCT.TIPS_REV;
  else if (input.planId === "merchandise") revenueCode = ACCT.OTHER_REV;

  let partyId: string | null = null;
  if (input.userId) {
    partyId = await ensureCustomerParty({
      userId: input.userId,
      name: input.memberName || input.memberEmail || input.userId,
      email: input.memberEmail,
      stripeCustomerId: input.stripeCustomerId,
    });
  }

  const label = isTip
    ? "Coach tip"
    : input.planId
      ? `Membership ${input.planId}`
      : "Membership payment";

  return postJournalEntry({
    entryDate: input.paidAt,
    memo: `${label} · ${input.amountCents}¢`,
    sourceSystem,
    sourceType: "FactSubscriptionPayment",
    sourceId: input.factId,
    currency: input.currency ?? "usd",
    status: "POSTED",
    lines: [
      {
        accountCode: cashCode,
        debitCents: input.amountCents,
        memo: `Cash · ${label}`,
        partyId,
        dimensions: { planId: input.planId, billingReason: input.billingReason },
      },
      {
        accountCode: revenueCode,
        creditCents: input.amountCents,
        memo: `Revenue · ${label}`,
        partyId,
        dimensions: { planId: input.planId, billingReason: input.billingReason },
      },
    ],
  });
}
