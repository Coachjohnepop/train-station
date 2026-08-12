import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformStaff } from "@/lib/api-auth";
import { postJournalEntry } from "@/lib/accounting-books/post-journal";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

const lineSchema = z.object({
  accountCode: z.string().min(1).max(20),
  debitDollars: z.number().min(0).max(1_000_000).optional(),
  creditDollars: z.number().min(0).max(1_000_000).optional(),
  memo: z.string().max(300).optional(),
});

const schema = z.object({
  entryDate: z.string().min(8).max(32).optional(),
  memo: z.string().min(1).max(500),
  lines: z.array(lineSchema).min(2).max(20),
});

/** Manual journal entry (staff). Always creates a new unique sourceId. */
export async function POST(request: Request) {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid journal. Need memo and at least two lines (debits = credits)." },
      { status: 400 },
    );
  }

  const lines = parsed.data.lines.map((l) => {
    const debitCents = Math.round((l.debitDollars || 0) * 100);
    const creditCents = Math.round((l.creditDollars || 0) * 100);
    return {
      accountCode: l.accountCode.trim(),
      debitCents: debitCents > 0 ? debitCents : 0,
      creditCents: creditCents > 0 ? creditCents : 0,
      memo: l.memo?.trim() || undefined,
    };
  });

  let entryDate = new Date();
  if (parsed.data.entryDate) {
    const d = new Date(parsed.data.entryDate);
    if (!Number.isNaN(d.getTime())) entryDate = d;
  }

  const sourceId = `manual-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;

  try {
    const result = await postJournalEntry({
      entryDate,
      memo: parsed.data.memo.trim(),
      sourceSystem: "MANUAL",
      sourceType: "manual_ui",
      sourceId,
      status: "POSTED",
      createdByUserId: auth.session.id,
      lines,
    });

    if (!result) {
      return NextResponse.json({ error: "Could not post journal (books unavailable)." }, { status: 503 });
    }

    return NextResponse.json({
      ok: true,
      id: result.id,
      entryNumber: result.entryNumber,
      created: result.created,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Journal post failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
