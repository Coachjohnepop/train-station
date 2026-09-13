import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canUseByowUpload } from "@/lib/byow-access";
import { parseByowNotes } from "@/lib/byow-build";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!canUseByowUpload(session)) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const rawText = typeof body.rawText === "string" ? body.rawText : "";
  if (!rawText.trim()) {
    return NextResponse.json({ error: "Paste or upload a notes file first." }, { status: 400 });
  }
  try {
    const parsed = parseByowNotes(rawText);
    return NextResponse.json({
      title: parsed.title,
      exercises: parsed.exercises.map((e) => ({
        name: e.name,
        sets: e.sets,
        reps: e.reps,
        notes: e.notes,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not parse notes.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
