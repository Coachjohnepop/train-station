import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canUseByowUpload } from "@/lib/byow-access";
import { buildByowWorkoutFromNotes } from "@/lib/byow-build";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session || !canUseByowUpload(session)) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const rawText = typeof body.rawText === "string" ? body.rawText : "";
  const filename = typeof body.filename === "string" ? body.filename : null;
  if (!rawText.trim()) {
    return NextResponse.json({ error: "Paste or upload a notes file first." }, { status: 400 });
  }
  try {
    const result = await buildByowWorkoutFromNotes({
      ownerUserId: session.id,
      rawText,
      filename,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not save workout.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
