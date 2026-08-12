import "server-only";

import { isDatabaseConfigured } from "@/lib/database-config";
import { isDemoMode } from "@/lib/demo-enrollments";
import { DEFAULT_ENTITY_CODE } from "@/lib/accounting-books/chart-of-accounts";
import { ensureAccountingBooks } from "@/lib/accounting-books/ensure-books";

function money(cents: number, currency = "usd"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

export async function getBooksSnapshot(options?: { journalLimit?: number }) {
  if (!isDatabaseConfigured() || isDemoMode()) {
    return {
      configured: false as const,
      message: "Database not configured.",
    };
  }

  await ensureAccountingBooks();
  const { prisma } = await import("@/lib/prisma");

  const entity = await prisma.acctEntity.findUnique({
    where: { code: DEFAULT_ENTITY_CODE },
  });
  if (!entity) {
    return { configured: false as const, message: "Books entity missing. Run seed." };
  }

  const journalLimit = Math.min(Math.max(options?.journalLimit ?? 40, 1), 100);

  const [accounts, journalRows, lineAgg] = await Promise.all([
    prisma.acctAccount.findMany({
      where: { entityId: entity.id, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    }),
    prisma.acctJournalEntry.findMany({
      where: { entityId: entity.id },
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      take: journalLimit,
      include: {
        lines: {
          orderBy: { lineNo: "asc" },
          include: {
            account: { select: { code: true, name: true } },
            party: { select: { name: true, email: true } },
          },
        },
      },
    }),
    prisma.acctJournalLine.groupBy({
      by: ["accountId"],
      where: {
        entry: { entityId: entity.id, status: "POSTED" },
      },
      _sum: { debitCents: true, creditCents: true },
    }),
  ]);

  const sumsByAccount = new Map(
    lineAgg.map((r) => [
      r.accountId,
      {
        debitCents: r._sum.debitCents ?? 0,
        creditCents: r._sum.creditCents ?? 0,
      },
    ]),
  );

  const chart = accounts.map((a) => {
    const s = sumsByAccount.get(a.id) || { debitCents: 0, creditCents: 0 };
    // Balance in normal-balance sense
    const balanceCents =
      a.normalBalance === "DEBIT"
        ? s.debitCents - s.creditCents
        : s.creditCents - s.debitCents;
    return {
      id: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      subtype: a.subtype,
      normalBalance: a.normalBalance,
      isSystem: a.isSystem,
      debitTotalCents: s.debitCents,
      creditTotalCents: s.creditCents,
      balanceCents,
      balanceLabel: money(balanceCents),
      debitTotalLabel: money(s.debitCents),
      creditTotalLabel: money(s.creditCents),
    };
  });

  // Proper trial balance columns
  const trialRows = chart
    .filter((a) => a.debitTotalCents > 0 || a.creditTotalCents > 0)
    .map((a) => {
      let debitCol = 0;
      let creditCol = 0;
      if (a.normalBalance === "DEBIT") {
        if (a.balanceCents >= 0) debitCol = a.balanceCents;
        else creditCol = Math.abs(a.balanceCents);
      } else {
        if (a.balanceCents >= 0) creditCol = a.balanceCents;
        else debitCol = Math.abs(a.balanceCents);
      }
      return {
        code: a.code,
        name: a.name,
        type: a.type,
        debitCents: debitCol,
        creditCents: creditCol,
        debitLabel: debitCol ? money(debitCol) : "—",
        creditLabel: creditCol ? money(creditCol) : "—",
      };
    });

  const trialDebitTotal = trialRows.reduce((s, r) => s + r.debitCents, 0);
  const trialCreditTotal = trialRows.reduce((s, r) => s + r.creditCents, 0);

  const journals = journalRows.map((j) => {
    const debits = j.lines.reduce((s, l) => s + l.debitCents, 0);
    const credits = j.lines.reduce((s, l) => s + l.creditCents, 0);
    return {
      id: j.id,
      entryNumber: j.entryNumber,
      entryDate: j.entryDate.toISOString().slice(0, 10),
      status: j.status,
      memo: j.memo,
      sourceSystem: j.sourceSystem,
      sourceType: j.sourceType,
      sourceId: j.sourceId,
      currency: j.currency,
      postedAt: j.postedAt?.toISOString() ?? null,
      amountCents: debits,
      amountLabel: money(debits, j.currency),
      balanced: debits === credits,
      lines: j.lines.map((l) => ({
        id: l.id,
        lineNo: l.lineNo,
        accountCode: l.account.code,
        accountName: l.account.name,
        partyName: l.party?.name ?? null,
        partyEmail: l.party?.email ?? null,
        debitCents: l.debitCents,
        creditCents: l.creditCents,
        debitLabel: l.debitCents ? money(l.debitCents, j.currency) : "",
        creditLabel: l.creditCents ? money(l.creditCents, j.currency) : "",
        memo: l.memo,
      })),
    };
  });

  const partyCount = await prisma.acctParty.count({ where: { entityId: entity.id } });

  return {
    configured: true as const,
    entity: {
      id: entity.id,
      code: entity.code,
      name: entity.name,
      currency: entity.currency,
    },
    counts: {
      accounts: chart.length,
      journals: journals.length,
      parties: partyCount,
    },
    chart,
    journals,
    trial: {
      rows: trialRows,
      debitTotalCents: trialDebitTotal,
      creditTotalCents: trialCreditTotal,
      debitTotalLabel: money(trialDebitTotal),
      creditTotalLabel: money(trialCreditTotal),
      balanced: trialDebitTotal === trialCreditTotal,
    },
    generatedAt: new Date().toISOString(),
  };
}
