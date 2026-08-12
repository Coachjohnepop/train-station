import { NextResponse } from "next/server";
import { requirePlatformStaff } from "@/lib/api-auth";
import { getBooksSnapshot } from "@/lib/accounting-books/query-books";

export const dynamic = "force-dynamic";

/** Chart of accounts, journals, trial balance for the in-app books UI. */
export async function GET(request: Request) {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") || "40");
    const data = await getBooksSnapshot({
      journalLimit: Number.isFinite(limit) ? limit : 40,
    });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not load books.";
    console.error("[admin/accounting/books]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
