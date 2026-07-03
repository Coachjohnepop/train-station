import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { runMartRollup } from "@/lib/mart-rollup";
import { isSecurityEnforced } from "@/lib/security-config";

export const dynamic = "force-dynamic";

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dryRun: z.boolean().optional(),
});

function cronAuthorized(request: Request): boolean {
  const secrets = [
    process.env.MART_ROLLUP_CRON_SECRET?.trim(),
    process.env.CRON_SECRET?.trim(),
  ].filter(Boolean) as string[];

  if (secrets.length === 0) return false;

  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7);
    if (secrets.includes(token)) return true;
  }

  if (isSecurityEnforced()) return false;

  const url = new URL(request.url);
  const param = url.searchParams.get("secret");
  return Boolean(param && secrets.includes(param));
}

async function handleRollup(request: Request) {
  const staff = await getSessionUser();
  const staffOk = Boolean(staff && isStaffRole(staff.role));
  const cronOk = cronAuthorized(request);

  if (!staffOk && !cronOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed =
    request.method === "GET"
      ? schema.safeParse({
          date: new URL(request.url).searchParams.get("date") || undefined,
          dryRun: new URL(request.url).searchParams.get("dryRun") === "true",
        })
      : schema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const result = await runMartRollup({
    metricDate: parsed.data.date,
    dryRun: parsed.data.dryRun,
  });

  if (result.skipped) {
    return NextResponse.json({ ...result, skipped: true }, { status: 200 });
  }

  return NextResponse.json(result);
}

export async function GET(request: Request) {
  return handleRollup(request);
}

export async function POST(request: Request) {
  return handleRollup(request);
}