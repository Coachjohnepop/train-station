import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { getMemberCoachPrefs, saveMemberCoachPrefs } from "@/lib/member-coach-prefs-store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ userId: string }> };

const patchSchema = z.object({
  alertOverrides: z.record(z.string(), z.unknown()).optional(),
});

async function requireStaff() {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) return null;
  return session;
}

export async function GET(_request: Request, { params }: Params) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;
  const prefs = await getMemberCoachPrefs(userId);
  return NextResponse.json({ prefs });
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;
  const body = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ detail: body.error.flatten() }, { status: 400 });
  }

  const prefs = await saveMemberCoachPrefs(userId, body.data.alertOverrides || {});
  return NextResponse.json({ prefs });
}