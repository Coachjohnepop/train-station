import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import {
  calendlyApiToken,
  createCalendlyWebhookSubscription,
  getCalendlyMe,
  listCalendlyWebhookSubscriptions,
  syncCalendlyBookingForEmail,
} from "@/lib/calendly-invitee";
import { calendlyWebhookSigningKey } from "@/lib/calendly-webhook";

export const dynamic = "force-dynamic";

const WEBHOOK_URL = "https://www.thetrainstation.co/api/calendly/webhook";

export async function GET() {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const tokenConfigured = Boolean(calendlyApiToken());
  const webhookKeyConfigured = Boolean(calendlyWebhookSigningKey());
  if (!tokenConfigured) {
    return NextResponse.json({
      ok: true,
      tokenConfigured: false,
      webhookKeyConfigured,
      me: null,
      webhooks: [],
      hint: "Create a Personal Access Token in Calendly → Integrations & apps → API & webhooks, then set CALENDLY_API_TOKEN on Vercel Production.",
    });
  }

  const me = await getCalendlyMe();
  const webhooks = await listCalendlyWebhookSubscriptions();
  return NextResponse.json({
    ok: true,
    tokenConfigured: true,
    webhookKeyConfigured,
    me: me
      ? { email: me.email, name: me.name, hasOrganization: Boolean(me.organization) }
      : null,
    webhooks: webhooks.map((w) => ({
      callbackUrl: w.callbackUrl,
      state: w.state,
      events: w.events,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    email?: string;
  };
  const action = body.action || "";

  if (action === "sync") {
    const email = body.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }
    const result = await syncCalendlyBookingForEmail(email);
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  }

  if (action === "ensure-webhook") {
    const existing = await listCalendlyWebhookSubscriptions();
    const already = existing.find((w) => w.callbackUrl.startsWith(WEBHOOK_URL));
    if (already) {
      return NextResponse.json({
        ok: true,
        created: false,
        callbackUrl: already.callbackUrl,
        detail: "Webhook already registered.",
      });
    }
    const created = await createCalendlyWebhookSubscription(WEBHOOK_URL);
    if (created.error) {
      return NextResponse.json({ ok: false, error: created.error }, { status: 502 });
    }
    return NextResponse.json({
      ok: true,
      created: true,
      uri: created.uri,
      signingKey: created.signingKey,
      hint: created.signingKey
        ? "Save signingKey as CALENDLY_WEBHOOK_SIGNING_KEY on Vercel Production, then redeploy."
        : "Webhook created. If Calendly did not return a signing key, copy it from the subscription in Calendly.",
    });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
