import { NextResponse } from "next/server";
import { sendSmsBroadcast, getUsersWithPhones } from "@/lib/sms";
import { requireStaff } from "@/lib/api-auth";
import { z } from "zod";

const broadcastSchema = z.object({
  userIds: z.array(z.string()).optional(),
  message: z.string().min(1).max(2000),
  category: z.enum(["fasted-cardio", "sleep", "exercise", "general"]).optional(), // eating coming soon
  taskDetails: z.any().optional(), // e.g. { targetProtein: 80, task: "20 pushups" }
  // filter could be added later e.g. "all" | "with-enrollments"
});

export async function GET() {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const users = await getUsersWithPhones();
  return NextResponse.json({ recipients: users });
}

export async function POST(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const parsed = broadcastSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  const { userIds, message, category, taskDetails } = parsed.data;
  const result = await sendSmsBroadcast({ userIds, message, category, taskDetails });

  return NextResponse.json({
    ok: true,
    sent: result.sent,
    logs: result.logs,
  });
}
