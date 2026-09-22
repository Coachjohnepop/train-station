import { NextResponse } from "next/server";
import { requireSession, assertUserScope } from "@/lib/api-auth";
import { isStaffRole } from "@/lib/staff-access";
import { localTodayIso } from "@/lib/program-calendar";
import { resolveLogSessionDate } from "@/lib/member-workout-log";
import { findCompletedSessionLog } from "@/lib/workout-logs-db";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const { id: workoutId } = await params;
  const url = new URL(request.url);
  const requestedUser = url.searchParams.get("forUser");
  const uid =
    isStaffRole(auth.session.role) && requestedUser ? requestedUser : auth.session.id;
  const scopeErr = assertUserScope(auth.session, uid);
  if (scopeErr) return scopeErr;

  const sessionDate = resolveLogSessionDate(url.searchParams.get("date"), localTodayIso());
  const existing = await findCompletedSessionLog({ userId: uid, workoutId, sessionDate });
  return NextResponse.json({
    logged: Boolean(existing),
    performedAt: existing?.performedAt ?? null,
    progress: existing?.progress ?? null,
  });
}
