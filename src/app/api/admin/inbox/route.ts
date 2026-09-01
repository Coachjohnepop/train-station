import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import {
  countUnreadCoachInbox,
  listCoachInbox,
  markAllCoachInboxRead,
  markCoachInboxRead,
  type CoachInboxKind,
} from "@/lib/coach-inbox";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get("unread") === "1";
  const kindRaw = searchParams.get("kind");
  const kind =
    kindRaw === "signup" || kindRaw === "booking" || kindRaw === "zoom"
      ? (kindRaw as CoachInboxKind)
      : undefined;

  const [items, unread] = await Promise.all([
    listCoachInbox({ unreadOnly, kind, limit: 80 }),
    countUnreadCoachInbox(),
  ]);
  return NextResponse.json({ ok: true, items, unread });
}

export async function POST(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    id?: string;
  };
  if (body.action === "readAll") {
    const count = await markAllCoachInboxRead();
    return NextResponse.json({ ok: true, count });
  }
  if (body.action === "read" && body.id) {
    const ok = await markCoachInboxRead(body.id);
    return NextResponse.json({ ok });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
