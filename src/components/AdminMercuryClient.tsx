"use client";

import { useEffect, useState } from "react";

type Txn = {
  id: string;
  amount: number;
  counterpartyName?: string | null;
  counterpartyNickname?: string | null;
  bankDescription?: string | null;
  kind?: string | null;
  createdAt?: string | null;
  postedAt?: string | null;
  estimatedDeliveryDate?: string | null;
  dashboardLink?: string | null;
  checkNumber?: string | null;
  accountName?: string;
  overdue?: boolean;
};

type Snapshot = {
  configured: boolean;
  error?: string;
  errors?: string[];
  totals?: {
    available: number;
    current: number;
    projected: number;
    outstandingCount: number;
    overdueCount: number;
  };
  outstanding?: Txn[];
  credit?: { id: string; availableBalance?: number | null; currentBalance?: number | null }[];
  treasury?: { id: string; name?: string | null; amount?: number | null }[];
  recipients?: { id: string; name: string; status?: string | null; paymentMethod?: string | null }[];
  accounts?: {
    id: string;
    name: string;
    availableBalance: number;
    currentBalance: number;
    dashboardLink?: string | null;
    statements: { id: string; endDate?: string | null; endingBalance?: number | null; downloadUrl?: string | null }[];
    cards: { cardId: string; nameOnCard?: string | null; lastFourDigits?: string | null; status?: string | null }[];
    transactions: Txn[];
  }[];
};

function money(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function day(iso?: string | null): string {
  return iso ? iso.slice(0, 10) : "—";
}

function who(txn: Txn): string {
  return txn.counterpartyNickname || txn.counterpartyName || txn.bankDescription || "—";
}

export default function AdminMercuryClient() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/admin/mercury", { cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as Snapshot & { error?: string };
        if (!res.ok) {
          setError(body.error || "Could not load Mercury.");
          return;
        }
        setData(body);
      })
      .catch(() => setError("Could not load Mercury."));
  }, []);

  if (error) return <p className="text-sm text-rose-300">{error}</p>;
  if (!data) return <p className="text-sm text-[var(--muted)]">Loading Mercury…</p>;
  if (!data.configured) {
    return (
      <div className="card max-w-xl space-y-2 p-4 text-sm">
        <p className="font-semibold">Connect Mercury</p>
        <p className="text-[var(--muted)]">
          Create a read token in Mercury under Settings → API Tokens, then set MERCURY_API_TOKEN on this app.
          Balances and the register show up after that.
        </p>
      </div>
    );
  }
  if (data.error) return <p className="text-sm text-rose-300">{data.error}</p>;

  const totals = data.totals;
  return (
    <div className="space-y-6">
      {data.errors && data.errors.length > 0 ? (
        <p className="text-xs text-amber-200">Some sections did not load: {data.errors.join(", ")}.</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Available" value={money(totals?.available ?? 0)} hint="Spendable now" />
        <Stat label="Current" value={money(totals?.current ?? 0)} hint="Includes holds" />
        <Stat label="If outstanding clears" value={money(totals?.projected ?? 0)} hint={`${totals?.outstandingCount ?? 0} in flight`} />
        <Stat
          label="Credit"
          value={data.credit?.length ? money(data.credit.reduce((sum, row) => sum + (row.currentBalance ?? 0), 0)) : "—"}
          hint={data.credit?.length ? "Mercury IO" : "No credit account"}
        />
      </div>

      <section className="card p-4">
        <h2 className="font-semibold">In flight</h2>
        {(data.outstanding ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">Nothing is waiting to clear.</p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-[var(--muted)]">
              <tr>
                <th className="py-1">Started</th>
                <th>Who</th>
                <th>Account</th>
                <th className="text-right">Amount</th>
                <th>Expected</th>
              </tr>
            </thead>
            <tbody>
              {(data.outstanding ?? []).map((txn) => (
                <tr key={txn.id} className="border-t border-[var(--border)]">
                  <td className="py-1.5">{day(txn.createdAt)}</td>
                  <td>{who(txn)}{txn.checkNumber ? ` · #${txn.checkNumber}` : ""}</td>
                  <td>{txn.accountName}</td>
                  <td className="text-right tabular-nums">{money(txn.amount)}</td>
                  <td className={txn.overdue ? "text-rose-300" : ""}>{day(txn.estimatedDeliveryDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {(data.accounts ?? []).map((account) => (
        <section key={account.id} className="card space-y-3 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">{account.name}</h2>
            <p className="text-sm text-[var(--muted)]">
              Available {money(account.availableBalance)} · Current {money(account.currentBalance)}
            </p>
          </div>
          <table className="w-full text-left text-sm">
            <tbody>
              {account.transactions.map((txn) => (
                <tr key={txn.id} className="border-t border-[var(--border)]">
                  <td className="py-1.5 w-28">{day(txn.postedAt || txn.createdAt)}</td>
                  <td>{who(txn)}</td>
                  <td className="text-[var(--muted)]">{txn.kind || ""}</td>
                  <td className="text-right tabular-nums">{money(txn.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {account.statements.length > 0 ? (
            <p className="text-xs text-[var(--muted)]">
              Statements:{" "}
              {account.statements.map((statement) => (
                <a key={statement.id} href={statement.downloadUrl || "#"} className="mr-3 underline" target="_blank" rel="noopener noreferrer">
                  {day(statement.endDate)} {statement.endingBalance != null ? money(statement.endingBalance) : ""}
                </a>
              ))}
            </p>
          ) : null}
          {account.cards.length > 0 ? (
            <p className="text-xs text-[var(--muted)]">
              Cards: {account.cards.map((card) => `${card.nameOnCard || "Card"} ···${card.lastFourDigits || ""}`).join(", ")}
            </p>
          ) : null}
        </section>
      ))}

      <section className="card p-4">
        <h2 className="font-semibold">Recipients</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {(data.recipients ?? []).length === 0 ? <li className="text-[var(--muted)]">None on this token.</li> : null}
          {(data.recipients ?? []).map((row) => (
            <li key={row.id}>
              {row.name} <span className="text-[var(--muted)]">{row.paymentMethod || ""} {row.status || ""}</span>
            </li>
          ))}
        </ul>
        {(data.treasury ?? []).length > 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            Treasury: {(data.treasury ?? []).map((row) => `${row.name || "Treasury"} ${money(row.amount ?? 0)}`).join(" · ")}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-[var(--muted)]">{hint}</p>
    </div>
  );
}
