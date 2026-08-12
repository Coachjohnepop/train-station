import { NextResponse } from "next/server";
import { requirePlatformStaff } from "@/lib/api-auth";
import { getBooksSnapshot } from "@/lib/accounting-books/query-books";

export const dynamic = "force-dynamic";

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** CSV export: trial | chart | journals */
export async function GET(request: Request) {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const type = (url.searchParams.get("type") || "trial").toLowerCase();
  if (!["trial", "chart", "journals"].includes(type)) {
    return NextResponse.json({ error: "type must be trial, chart, or journals." }, { status: 400 });
  }

  try {
    const data = await getBooksSnapshot({ journalLimit: 200 });
    if (!data.configured) {
      return NextResponse.json({ error: data.message || "Books not configured." }, { status: 503 });
    }

    const lines: string[] = [];
    const stamp = new Date().toISOString().slice(0, 10);
    let filename = `ts-books-${type}-${stamp}.csv`;

    if (type === "trial") {
      lines.push(["code", "name", "type", "debit", "credit"].join(","));
      for (const r of data.trial.rows) {
        lines.push(
          [r.code, r.name, r.type, r.debitCents / 100, r.creditCents / 100]
            .map(csvEscape)
            .join(","),
        );
      }
      lines.push(
        ["TOTAL", "", "", data.trial.debitTotalCents / 100, data.trial.creditTotalCents / 100]
          .map(csvEscape)
          .join(","),
      );
    } else if (type === "chart") {
      lines.push(
        ["code", "name", "type", "balance", "debit_activity", "credit_activity"].join(","),
      );
      for (const a of data.chart) {
        lines.push(
          [
            a.code,
            a.name,
            a.type,
            a.balanceCents / 100,
            a.debitTotalCents / 100,
            a.creditTotalCents / 100,
          ]
            .map(csvEscape)
            .join(","),
        );
      }
    } else {
      lines.push(
        [
          "entry_number",
          "date",
          "status",
          "memo",
          "source",
          "account_code",
          "account_name",
          "party",
          "debit",
          "credit",
          "line_memo",
        ].join(","),
      );
      for (const j of data.journals) {
        for (const l of j.lines) {
          lines.push(
            [
              j.entryNumber,
              j.entryDate,
              j.status,
              j.memo || "",
              j.sourceSystem,
              l.accountCode,
              l.accountName,
              l.partyName || "",
              l.debitCents / 100 || "",
              l.creditCents / 100 || "",
              l.memo || "",
            ]
              .map(csvEscape)
              .join(","),
          );
        }
      }
      filename = `ts-books-journals-${stamp}.csv`;
    }

    const body = lines.join("\n") + "\n";
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Export failed.";
    console.error("[admin/accounting/books/export]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
