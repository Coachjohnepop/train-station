import { NextResponse } from "next/server";
import { requireCoachStaff } from "@/lib/api-auth";
import { clearZoomOAuthRecord } from "@/lib/zoom-oauth-store";

export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  await clearZoomOAuthRecord();
  return NextResponse.json({ ok: true });
}