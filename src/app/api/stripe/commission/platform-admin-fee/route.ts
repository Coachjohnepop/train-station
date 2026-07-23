import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import {
  platformAdminFeeCentsFromEnv,
  platformAdminFeeDollarsFromEnv,
  platformAdminPartnerEmailFromEnv,
  platformAdminPeriod,
  previewPlatformAdminFee,
  runPlatformAdminFee,
} from "@/lib/platform-admin-fee";

export const dynamic = "force-dynamic";

const schema = z.object({
  dryRun: z.boolean().optional(),
});

/** GET — preview platform admin fee config + Connect readiness. */
export async function GET() {
  const staff = await getSessionUser();
  if (!staff || !isStaffRole(staff.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const preview = await previewPlatformAdminFee();
  if ("error" in preview) {
    return NextResponse.json({
      ok: false,
      error: preview.error,
      amountCents: platformAdminFeeCentsFromEnv(),
      amountLabel: `$${platformAdminFeeDollarsFromEnv()}`,
      partnerEmail: platformAdminPartnerEmailFromEnv(),
      period: platformAdminPeriod(),
    });
  }

  return NextResponse.json({ ok: true, ...preview });
}

/** POST — dry-run or execute $275 (default) Connect transfer to John. */
export async function POST(request: Request) {
  const staff = await getSessionUser();
  if (!staff || !isStaffRole(staff.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const result = await runPlatformAdminFee({ dryRun: parsed.data.dryRun === true });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  return NextResponse.json(result);
}
