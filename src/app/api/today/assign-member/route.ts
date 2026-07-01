import { NextResponse } from "next/server";
import { z } from "zod";
import {
  addMemberToPrimarySession,
  addMemberToTodaySession,
  cascadeWorkoutFromMember,
} from "@/lib/today-sessions";
import { requireStaff } from "@/lib/api-auth";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add-to-session"),
    sessionId: z.string().min(1),
    userId: z.string().min(1),
  }),
  z.object({
    action: z.literal("add-to-primary"),
    sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    userId: z.string().min(1),
  }),
  z.object({
    action: z.literal("cascade-from"),
    sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    sourceUserId: z.string().min(1),
    targetUserIds: z.array(z.string()).min(1),
  }),
]);

export async function POST(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const body = parsed.data;
    if (body.action === "add-to-session") {
      const result = await addMemberToTodaySession(body.sessionId, body.userId);
      return NextResponse.json(result);
    }
    if (body.action === "add-to-primary") {
      const result = await addMemberToPrimarySession(body.sessionDate, body.userId);
      return NextResponse.json(result);
    }
    const result = await cascadeWorkoutFromMember(body);
    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Assign failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}