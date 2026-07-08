import { NextResponse } from "next/server";
import { z } from "zod";
import { parseSmsWorkout } from "@/lib/sms-workout-parser";
import { requireStaff } from "@/lib/api-auth";

const schema = z.object({
  rawSms: z.string().min(1),
});

export async function POST(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }
  const workout = parseSmsWorkout(parsed.data.rawSms);
  return NextResponse.json({ workout });
}