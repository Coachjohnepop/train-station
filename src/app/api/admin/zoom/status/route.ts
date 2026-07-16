import { NextResponse } from "next/server";
import { requireCoachStaff } from "@/lib/api-auth";
import { getZoomCoachStatus } from "@/lib/zoom-status";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const status = await getZoomCoachStatus(auth.session.email);
  return NextResponse.json(
    {
      ...status,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    },
  );
}