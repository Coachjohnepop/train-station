import { NextResponse } from "next/server";
import { requireCoachStaff } from "@/lib/api-auth";
import { clearZoomOAuthRecord } from "@/lib/zoom-oauth-store";
import { getZoomCoachStatus } from "@/lib/zoom-status";

export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const { blobSaved } = await clearZoomOAuthRecord(auth.session.email);
  const status = await getZoomCoachStatus();

  return NextResponse.json(
    {
      ok: true,
      blobSaved,
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