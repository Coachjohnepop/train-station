import { NextResponse } from "next/server";
import { z } from "zod";
import { moveTodaySession } from "@/lib/today-sessions";
import { requireStaff } from "@/lib/api-auth";

const schema = z.object({
  sessionId: z.string().min(1),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await moveTodaySession(parsed.data.sessionId, parsed.data.toDate);
    return NextResponse.json({
      session: result.session,
      moved: result.moved,
      fromDate: result.fromDate,
      toDate: result.session.sessionDate,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Move failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
