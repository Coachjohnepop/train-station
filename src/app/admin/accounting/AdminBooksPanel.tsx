"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ChartRow = {
  code: string;
  name: string;
  type: string;
  balanceLabel: string;
  debitTotalLabel: string;
  creditTotalLabel: string;
  balanceCents: number;
};

type JournalLine = {
  id: string;
  accountCode: string;
  accountName: string;
  partyName: string | null;
  debitLabel: string;
  creditLabel: string;
  memo: string | null;
};

type JournalRow = {
  id: string;
  entryNumber: string;
  entryDate: string;
  status: string;
  memo: string | null;
  sourceSystem: string;
  amountLabel: string;
  balanced: boolean;
  lines: JournalLine[];
};

type TrialRow = {
  code: string;
  name: string;
  type: string;
  debitLabel: string;
  creditLabel: string;
};

type BooksData = {
  configured: boolean;
  message?: string;
  entity?: { name: string; code: string; currency: string };
  counts?: { accounts: number; journals: number; parties: number };
  chart?: ChartRow[];
  journals?: JournalRow[];
  trial?: {
    rows: TrialRow[];
    debitTotalLabel: string;
    creditTotalLabel: string;
    balanced: boolean;
  };
  generatedAt?: string;
};

type Tab = "journals" | "chart" | "trial";

type FormLine = {
  accountCode: string;
  debitDollars: string;
  creditDollars: string;
  memo: string;
};

const TYPE_TONE: Record<string, string> = {
  ASSET: "text-sky-300",
  LIABILITY: "text-amber-300",
  EQUITY: "text-violet-300",
  REVENUE: "text-emerald-300",
  EXPENSE: "text-rose-300",
};

function emptyLine(): FormLine {
  return { accountCode: "1000", debitDollars: "", creditDollars: "", memo: "" };
}

function todayIsoDate(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default function AdminBooksPanel() {
  const [tab, setTab] = useState<Tab>("journals");
  const [data, setData] = useState<BooksData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState(todayIsoDate);
  const [formMemo, setFormMemo] = useState("");
  const [formLines, setFormLines] = useState<FormLine[]>([
    { accountCode: "1000", debitDollars: "", creditDollars: "", memo: "" },
    { accountCode: "4000", debitDollars: "", creditDollars: "", memo: "" },
  ]);
  const [posting, setPosting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formOk, setFormOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/accounting/books?limit=50", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Could not load books.");
        setData(null);
        return;
      }
      setData(body);
    } catch {
      setError("Could not load books.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const formTotals = useMemo(() => {
    let d = 0;
    let c = 0;
    for (const line of formLines) {
      d += Number(line.debitDollars) || 0;
      c += Number(line.creditDollars) || 0;
    }
    return {
      debit: d,
      credit: c,
      balanced: Math.abs(d - c) < 0.005 && d > 0,
    };
  }, [formLines]);

  async function submitJournal() {
    setFormError(null);
    setFormOk(null);
    if (!formMemo.trim()) {
      setFormError("Memo is required.");
      return;
    }
    if (!formTotals.balanced) {
      setFormError("Debits must equal credits and be greater than zero.");
      return;
    }
    setPosting(true);
    try {
      const res = await fetch("/api/admin/accounting/books/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryDate: formDate,
          memo: formMemo.trim(),
          lines: formLines.map((l) => ({
            accountCode: l.accountCode,
            debitDollars: Number(l.debitDollars) || 0,
            creditDollars: Number(l.creditDollars) || 0,
            memo: l.memo.trim() || undefined,
          })),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(body.error || "Could not post journal.");
        return;
      }
      setFormOk(`Posted ${body.entryNumber}`);
      setFormMemo("");
      setFormLines([emptyLine(), emptyLine()]);
      setShowForm(false);
      setTab("journals");
      await load();
      if (body.id) setOpenId(body.id);
    } catch {
      setFormError("Could not post journal.");
    } finally {
      setPosting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Loading general ledger…</p>;
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
        {error || "No data."}
        <button type="button" className="btn-ghost ml-3 text-xs" onClick={() => void load()}>
          Retry
        </button>
      </div>
    );
  }

  if (!data.configured) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
        {data.message || "Books not configured."}
        <p className="mt-2 text-xs text-amber-100/80">
          Run{" "}
          <code className="rounded bg-black/20 px-1">
            node scripts/seed-accounting-books-prod.mjs
          </code>
        </p>
      </div>
    );
  }

  const accountOptions = data.chart || [];
  const tabs: { id: Tab; label: string }[] = [
    { id: "journals", label: "Journals" },
    { id: "chart", label: "Chart of accounts" },
    { id: "trial", label: "Trial balance" },
  ];

  return (
    <div className="space-y-4" id="books-gl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{data.entity?.name} · Books</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            In-app general ledger (source of truth for TS books) ·{" "}
            {data.counts?.accounts ?? 0} accounts · {data.counts?.journals ?? 0} journals ·{" "}
            {data.counts?.parties ?? 0} parties · bank feed later
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary text-xs"
            onClick={() => {
              setShowForm((v) => !v);
              setFormError(null);
              setFormOk(null);
            }}
          >
            {showForm ? "Close form" : "Add journal"}
          </button>
          <button type="button" className="btn-ghost text-xs" onClick={() => void load()}>
            Refresh
          </button>
        </div>
      </div>

      {formOk ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {formOk}
        </p>
      ) : null}

      {showForm ? (
        <div className="space-y-3 rounded-xl border border-accent/30 bg-accent/5 p-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">New journal entry</h3>
              <p className="text-[11px] text-[var(--muted)]">
                Debits must equal credits. Posts immediately to the GL.
              </p>
            </div>
            <p
              className={`text-xs font-semibold tabular-nums ${
                formTotals.balanced ? "text-emerald-300" : "text-amber-300"
              }`}
            >
              Dr ${formTotals.debit.toFixed(2)} · Cr ${formTotals.credit.toFixed(2)}
              {formTotals.balanced ? " · balanced" : " · out of balance"}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-[var(--muted)]" htmlFor="je-date">
                Date
              </label>
              <input
                id="je-date"
                type="date"
                className="input mt-1 w-full"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--muted)]" htmlFor="je-memo">
                Memo *
              </label>
              <input
                id="je-memo"
                className="input mt-1 w-full"
                placeholder="e.g. Reclass bank fee · July"
                value={formMemo}
                onChange={(e) => setFormMemo(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            {formLines.map((line, idx) => (
              <div
                key={idx}
                className="grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 sm:grid-cols-12"
              >
                <div className="sm:col-span-4">
                  <label className="text-[10px] text-[var(--muted)]">Account</label>
                  <select
                    className="input mt-0.5 w-full text-xs"
                    value={line.accountCode}
                    onChange={(e) => {
                      const next = [...formLines];
                      next[idx] = { ...next[idx], accountCode: e.target.value };
                      setFormLines(next);
                    }}
                  >
                    {accountOptions.map((a) => (
                      <option key={a.code} value={a.code}>
                        {a.code} · {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[10px] text-[var(--muted)]">Debit $</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    className="input mt-0.5 w-full text-xs"
                    value={line.debitDollars}
                    onChange={(e) => {
                      const next = [...formLines];
                      next[idx] = {
                        ...next[idx],
                        debitDollars: e.target.value,
                        creditDollars: e.target.value ? "" : next[idx].creditDollars,
                      };
                      setFormLines(next);
                    }}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[10px] text-[var(--muted)]">Credit $</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    className="input mt-0.5 w-full text-xs"
                    value={line.creditDollars}
                    onChange={(e) => {
                      const next = [...formLines];
                      next[idx] = {
                        ...next[idx],
                        creditDollars: e.target.value,
                        debitDollars: e.target.value ? "" : next[idx].debitDollars,
                      };
                      setFormLines(next);
                    }}
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="text-[10px] text-[var(--muted)]">Line memo</label>
                  <input
                    className="input mt-0.5 w-full text-xs"
                    value={line.memo}
                    onChange={(e) => {
                      const next = [...formLines];
                      next[idx] = { ...next[idx], memo: e.target.value };
                      setFormLines(next);
                    }}
                  />
                </div>
                <div className="flex items-end sm:col-span-1">
                  <button
                    type="button"
                    className="btn-ghost w-full px-2 py-2 text-xs"
                    disabled={formLines.length <= 2}
                    onClick={() => setFormLines(formLines.filter((_, i) => i !== idx))}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={() => setFormLines([...formLines, emptyLine()])}
            >
              + Line
            </button>
            <button
              type="button"
              className="btn-primary text-xs"
              disabled={posting || !formTotals.balanced}
              onClick={() => void submitJournal()}
            >
              {posting ? "Posting…" : "Post journal"}
            </button>
          </div>
          {formError ? <p className="text-sm text-amber-200">{formError}</p> : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              tab === t.id
                ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
                : "text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "journals" && (
        <div className="space-y-2">
          {(data.journals || []).length === 0 ? (
            <p className="rounded-xl border border-[var(--border)] px-4 py-6 text-sm text-[var(--muted)]">
              No journal entries yet. Use <strong>Add journal</strong>, or wait for card / Mark paid
              posts.
            </p>
          ) : (
            (data.journals || []).map((j) => {
              const open = openId === j.id;
              return (
                <div
                  key={j.id}
                  className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]"
                >
                  <button
                    type="button"
                    className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left transition hover:bg-[var(--surface-2)]"
                    onClick={() => setOpenId(open ? null : j.id)}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold">
                        <span className="text-accent">{j.entryNumber}</span>
                        <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                          {j.entryDate}
                        </span>
                        <span
                          className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                            j.status === "POSTED"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : j.status === "VOID"
                                ? "bg-rose-500/15 text-rose-300"
                                : "bg-amber-500/15 text-amber-200"
                          }`}
                        >
                          {j.status}
                        </span>
                      </p>
                      <p className="truncate text-xs text-[var(--muted)]">
                        {j.memo || "—"} · {j.sourceSystem}
                        {!j.balanced ? " · ⚠ unbalanced" : ""}
                      </p>
                    </div>
                    <p className="shrink-0 tabular-nums font-semibold">{j.amountLabel}</p>
                  </button>
                  {open ? (
                    <div className="border-t border-[var(--border)] bg-[var(--surface-2)]/50 px-2 py-2">
                      <table className="w-full text-left text-xs">
                        <thead className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                          <tr>
                            <th className="px-2 py-1">Account</th>
                            <th className="px-2 py-1">Party</th>
                            <th className="px-2 py-1 text-right">Debit</th>
                            <th className="px-2 py-1 text-right">Credit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {j.lines.map((l) => (
                            <tr key={l.id} className="border-t border-[var(--border)]/60">
                              <td className="px-2 py-1.5">
                                <span className="font-mono text-accent">{l.accountCode}</span>{" "}
                                {l.accountName}
                              </td>
                              <td className="px-2 py-1.5 text-[var(--muted)]">
                                {l.partyName || "—"}
                              </td>
                              <td className="px-2 py-1.5 text-right tabular-nums">
                                {l.debitLabel || ""}
                              </td>
                              <td className="px-2 py-1.5 text-right tabular-nums">
                                {l.creditLabel || ""}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === "chart" && (
        <div className="space-y-2">
          <div className="overflow-hidden rounded-xl border border-[var(--border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--surface-2)] text-[10px] uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Account</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {(data.chart || []).map((a) => (
                  <tr key={a.code} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2 font-mono text-xs text-accent">{a.code}</td>
                    <td className="px-3 py-2 font-medium">{a.name}</td>
                    <td className={`px-3 py-2 text-xs font-semibold ${TYPE_TONE[a.type] || ""}`}>
                      {a.type}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">
                      {a.balanceCents === 0 ? (
                        <span className="text-[var(--muted)]">—</span>
                      ) : (
                        a.balanceLabel
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "trial" && (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-[var(--border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--surface-2)] text-[10px] uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Account</th>
                  <th className="px-3 py-2 text-right">Debit</th>
                  <th className="px-3 py-2 text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {(data.trial?.rows || []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-[var(--muted)]">
                      No posted activity yet.
                    </td>
                  </tr>
                ) : (
                  (data.trial?.rows || []).map((r) => (
                    <tr key={r.code} className="border-t border-[var(--border)]">
                      <td className="px-3 py-2 font-mono text-xs text-accent">{r.code}</td>
                      <td className="px-3 py-2">{r.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.debitLabel}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.creditLabel}</td>
                    </tr>
                  ))
                )}
                {(data.trial?.rows || []).length > 0 ? (
                  <tr className="border-t-2 border-[var(--border)] bg-[var(--surface-2)] font-semibold">
                    <td className="px-3 py-2" colSpan={2}>
                      Totals
                      {data.trial?.balanced ? (
                        <span className="ml-2 text-[10px] font-bold uppercase text-emerald-300">
                          Balanced
                        </span>
                      ) : (
                        <span className="ml-2 text-[10px] font-bold uppercase text-amber-300">
                          Out of balance
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {data.trial?.debitTotalLabel}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {data.trial?.creditTotalLabel}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-[var(--muted)]">
            Trial balance from posted journals only. Debits must equal credits. Bank reconciliation
            and feeds will land here later — no CSV export path.
          </p>
        </div>
      )}

      {data.generatedAt ? (
        <p className="text-[10px] text-[var(--muted)]">
          Generated {new Date(data.generatedAt).toLocaleString()}
        </p>
      ) : null}
    </div>
  );
}
