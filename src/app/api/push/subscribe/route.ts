import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { removePushSubscription, savePushSubscription } from "@/lib/web-push";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  try {
    const json = await request.json();
    const input = subscribeSchema.parse(json);
    const ua = request.headers.get("user-agent");
    await savePushSubscription({
      userId: session.id,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent: ua,
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e && typeof e === "object" && "name" in e && (e as { name: string }).name === "ZodError") {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : "Subscribe failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  try {
    const json = await request.json().catch(() => ({}));
    const endpoint = typeof json.endpoint === "string" ? json.endpoint : "";
    if (!endpoint) {
      return NextResponse.json({ error: "endpoint required" }, { status: 400 });
    }
    await removePushSubscription(endpoint, session.id);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unsubscribe failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
