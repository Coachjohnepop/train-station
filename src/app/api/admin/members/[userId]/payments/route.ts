import { NextResponse } from "next/server";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { listPaymentLedger } from "@/lib/analytics-facts";

type RouteContext = { params: Promise<{ userId: string }> };

export const dynamic = "force-dynamic";

/** Payment history for one member (Admin). */
export async function GET(_request: Request, context: RouteContext) {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await context.params;
  if (!userId) {
    return NextResponse.json({ error: "Missing user id." }, { status: 400 });
  }

  const data = await listPaymentLedger({ userId, limit: 50 });
  return NextResponse.json(
    {
      ...data,
      rows: data.rows.map((r) => ({
        ...r,
        paidAt: r.paidAtLabel,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
