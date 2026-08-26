import { NextResponse } from "next/server";
import {
  calendlyWebhookSharedSecret,
  calendlyWebhookSigningKey,
  processCalendlyWebhookBody,
  verifyCalendlyWebhookSignature,
} from "@/lib/calendly-webhook";

export const dynamic = "force-dynamic";

/**
 * Calendly → POST https://www.thetrainstation.co/api/calendly/webhook
 *
 * Subscribe in Calendly Developer / Integrations → Webhooks:
 *   events: invitee.created, invitee.canceled
 *   scope: user or organization (Jeremy’s account)
 *
 * Env (Vercel Production):
 *   CALENDLY_WEBHOOK_SIGNING_KEY  — signing key from the subscription (recommended)
 *   CALENDLY_WEBHOOK_SECRET       — optional ?secret= fallback if no signing key yet
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signingKey = calendlyWebhookSigningKey();
  const shared = calendlyWebhookSharedSecret();
  const signature = request.headers.get("Calendly-Webhook-Signature");

  if (signingKey) {
    const verified = verifyCalendlyWebhookSignature(rawBody, signature, signingKey);
    if (!verified.ok) {
      console.warn("[calendly/webhook] signature failed", verified.error);
      return NextResponse.json({ error: verified.error }, { status: 401 });
    }
  } else if (shared) {
    const url = new URL(request.url);
    const q = url.searchParams.get("secret") || "";
    const headerSecret =
      request.headers.get("x-calendly-webhook-secret") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      "";
    if (q !== shared && headerSecret !== shared) {
      return NextResponse.json({ error: "Invalid webhook secret." }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        error:
          "Calendly webhook not configured. Set CALENDLY_WEBHOOK_SIGNING_KEY (or CALENDLY_WEBHOOK_SECRET) on Vercel.",
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const result = await processCalendlyWebhookBody(body);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Webhook processing failed";
    console.error("[calendly/webhook]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Health / subscription probe — Calendly may GET the URL when testing. */
export async function GET() {
  const configured = Boolean(calendlyWebhookSigningKey() || calendlyWebhookSharedSecret());
  return NextResponse.json({
    ok: true,
    service: "calendly-webhook",
    configured,
    hint: configured
      ? "POST invitee.created / invitee.canceled payloads here."
      : "Set CALENDLY_API_TOKEN and CALENDLY_WEBHOOK_SIGNING_KEY on Vercel Production.",
  });
}
