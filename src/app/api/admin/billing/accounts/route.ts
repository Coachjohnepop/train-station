import { NextResponse } from "next/server";
import { requirePlatformStaff } from "@/lib/api-auth";
import { listMoneyAccounts } from "@/lib/stripe-account-money";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;

  try {
    const result = await listMoneyAccounts();
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not load accounts.";
    console.error("[admin/billing/accounts]", message);
    return NextResponse.json({ error: message, accounts: [] }, { status: 500 });
  }
}
