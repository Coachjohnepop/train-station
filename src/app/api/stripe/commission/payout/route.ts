import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { automatedCommissionPayoutAllowed, getCoachSettings } from "@/lib/coach-settings-store";
import { runCommissionPayout } from "@/lib/stripe-commission-payout";
import { previousCommissionPeriod } from "@/lib/stripe-commission";
import { isSecurityEnforced } from "@/lib/security-config";

export const dynamic = "force-dynamic";

const schema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  dryRun: z.boolean().optional(),
});

function cronAuthorized(request: Request): boolean {
  const secret = process.env.STRIPE_COMMISSION_CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  if (isSecurityEnforced()) return false;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

export async function POST(request: Request) {
  const staff = await getSessionUser();
  const staffOk = Boolean(staff && isStaffRole(staff.role));
  const cronOk = cronAuthorized(request);

  if (!staffOk && !cronOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (cronOk && !staffOk) {
    const settings = await getCoachSettings();
    const gate = automatedCommissionPayoutAllowed(settings);
    if (!gate.allowed) {
      return NextResponse.json({ error: gate.reason, skipped: true }, { status: 409 });
    }
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const result = await runCommissionPayout({
    period: parsed.data.period || previousCommissionPeriod(),
    dryRun: parsed.data.dryRun,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  return NextResponse.json(result);
}