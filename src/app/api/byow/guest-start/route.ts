import { NextResponse } from "next/server";
import { z } from "zod";
import { startByowGuest } from "@/lib/byow-guest";

export const dynamic = "force-dynamic";

const schema = z.object({
  username: z.string().min(3).max(24).optional(),
  path: z.enum(["own", "jeremy"]),
  rawText: z.string().max(20000).optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Pick a path to get started." }, { status: 400 });
  }
  try {
    const started = await startByowGuest({
      username: parsed.data.username,
      path: parsed.data.path,
      rawText: parsed.data.rawText,
    });
    const res = NextResponse.json({
      ok: true,
      redirectTo: started.redirectTo,
      workoutId: started.workoutId ?? null,
      username: started.username,
    });
    started.applyCookies(res);
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not start.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
