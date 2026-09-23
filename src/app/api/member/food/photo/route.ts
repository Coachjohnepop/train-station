import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { estimateFoodPhoto } from "@/lib/food-estimate";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const image = typeof body?.image === "string" ? body.image : "";
  const result = await estimateFoodPhoto(image);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, draft: result });
}
