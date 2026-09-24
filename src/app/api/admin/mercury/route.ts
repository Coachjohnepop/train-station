import { NextResponse } from "next/server";
import { requirePlatformStaff } from "@/lib/api-auth";
import {
  listMercuryAccounts,
  listMercuryCards,
  listMercuryCreditAccounts,
  listMercuryRecipients,
  listMercuryStatements,
  listMercuryTransactions,
  listMercuryTreasury,
  mercuryConfigured,
  type MercuryTransaction,
} from "@/lib/mercury";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

function isDead(row: MercuryTransaction) {
  return row.status === "cancelled" || row.status === "failed";
}

export async function GET() {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;
  if (!mercuryConfigured()) {
    return NextResponse.json({ configured: false });
  }

  const errors: string[] = [];
  try {
    const accounts = await listMercuryAccounts();
    const start = new Date(Date.now() - 90 * DAY_MS);
    const details = await Promise.all(
      accounts.map(async (account) => {
        const [transactions, statements, cards] = await Promise.all([
          listMercuryTransactions(account.id, { start, limit: 200 }).catch(() => {
            errors.push(`transactions (${account.name})`);
            return [] as MercuryTransaction[];
          }),
          listMercuryStatements(account.id).catch(() => {
            errors.push(`statements (${account.name})`);
            return [];
          }),
          listMercuryCards(account.id).catch(() => {
            errors.push(`cards (${account.name})`);
            return [];
          }),
        ]);
        transactions.sort((a, b) =>
          (b.postedAt ?? b.createdAt ?? "").localeCompare(a.postedAt ?? a.createdAt ?? ""),
        );
        return { account, transactions, statements: statements.slice(0, 12), cards };
      }),
    );
    const [credit, treasury, recipients] = await Promise.all([
      listMercuryCreditAccounts().catch(() => {
        errors.push("credit");
        return [];
      }),
      listMercuryTreasury().catch(() => {
        errors.push("treasury");
        return [];
      }),
      listMercuryRecipients().catch(() => {
        errors.push("recipients");
        return [];
      }),
    ]);

    const outstanding = details.flatMap((row) =>
      row.transactions
        .filter((txn) => !isDead(txn) && !txn.postedAt)
        .map((txn) => ({
          ...txn,
          accountName: row.account.name,
          overdue: Boolean(
            txn.estimatedDeliveryDate &&
              Date.now() - new Date(txn.estimatedDeliveryDate).getTime() > DAY_MS,
          ),
        })),
    );
    const available = accounts.reduce((sum, account) => sum + (account.availableBalance ?? 0), 0);
    const current = accounts.reduce((sum, account) => sum + (account.currentBalance ?? 0), 0);
    const pendingNet = outstanding.reduce((sum, txn) => sum + txn.amount, 0);

    return NextResponse.json({
      configured: true,
      errors,
      totals: {
        available,
        current,
        projected: available + pendingNet,
        outstandingCount: outstanding.length,
        overdueCount: outstanding.filter((txn) => txn.overdue).length,
      },
      credit,
      treasury,
      recipients: recipients.map((row) => ({
        id: row.id,
        name: row.name,
        status: row.status ?? null,
        paymentMethod: row.paymentMethod ?? null,
      })),
      outstanding,
      accounts: details.map((row) => ({
        id: row.account.id,
        name: row.account.name,
        kind: row.account.kind ?? null,
        status: row.account.status ?? null,
        availableBalance: row.account.availableBalance ?? 0,
        currentBalance: row.account.currentBalance ?? 0,
        dashboardLink: row.account.dashboardLink ?? null,
        statements: row.statements,
        cards: row.cards,
        transactions: row.transactions.slice(0, 40),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not reach Mercury.";
    return NextResponse.json({ configured: true, error: message, errors });
  }
}
