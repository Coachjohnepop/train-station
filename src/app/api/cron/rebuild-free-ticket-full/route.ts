import { NextResponse } from "next/server";
import {
  queuedFreeTicketFullIntro,
  runRebuildFreeTicketFullJob,
} from "@/lib/free-ticket-full-job";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

/** Safety net if Admin save queued a rebuild but ffmpeg was not on that box. */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const introUrl = await queuedFreeTicketFullIntro();
  if (!introUrl) {
    return NextResponse.json({ ok: true, skipped: true });
  }
  try {
    const result = await runRebuildFreeTicketFullJob(introUrl);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Rebuild failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
