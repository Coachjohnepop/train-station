import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import {
  calendlyPublicStatus,
  clearCalendlyIntegration,
  resolveCalendlyCredentials,
  saveCalendlyIntegration,
} from "@/lib/calendly-credentials";
import {
  backfillCalendlyBookings,
  CALENDLY_WEBHOOK_URL,
  ensureCalendlyWebhookForApp,
  getCalendlyMe,
  listCalendlyWebhookSubscriptions,
  probeCalendlyToken,
  syncCalendlyBookingForEmail,
} from "@/lib/calendly-invitee";

export const dynamic = "force-dynamic";

async function statusPayload() {
  const creds = await resolveCalendlyCredentials();
  const publicStatus = calendlyPublicStatus(creds);
  if (!publicStatus.tokenConfigured) {
    return {
      ok: true,
      ...publicStatus,
      me: null,
      webhooks: [],
      webhookUrl: CALENDLY_WEBHOOK_URL,
      hint: "Paste a Calendly personal access token below. Calendly → Integrations & apps → API & webhooks → Personal access tokens (Jeremy’s account).",
    };
  }

  const me = await getCalendlyMe();
  const webhooks = await listCalendlyWebhookSubscriptions();
  return {
    ok: true,
    ...publicStatus,
    me: me
      ? { email: me.email, name: me.name, hasOrganization: Boolean(me.organization) }
      : null,
    webhooks: webhooks.map((w) => ({
      callbackUrl: w.callbackUrl,
      state: w.state,
      events: w.events,
    })),
    webhookUrl: CALENDLY_WEBHOOK_URL,
    webhookRegistered: webhooks.some((w) =>
      w.callbackUrl.startsWith(CALENDLY_WEBHOOK_URL.split("?")[0]),
    ),
  };
}

export async function GET() {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  return NextResponse.json(await statusPayload());
}

export async function POST(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    email?: string;
    token?: string;
  };
  const action = body.action || "";

  if (action === "connect") {
    const token = body.token?.trim() || "";
    if (!token) {
      return NextResponse.json({ error: "Paste the Calendly personal access token." }, { status: 400 });
    }
    const me = await probeCalendlyToken(token);
    if (!me?.uri) {
      return NextResponse.json(
        { error: "Calendly rejected that token. Create a new Personal access token and try again." },
        { status: 422 },
      );
    }
    await saveCalendlyIntegration({
      apiToken: token,
      connectedEmail: me.email,
      connectedName: me.name,
      connectedByEmail: auth.session.email,
    });
    const webhook = await ensureCalendlyWebhookForApp();
    const status = await statusPayload();
    return NextResponse.json({
      ...status,
      connected: true,
      webhook,
      detail: webhook.ok
        ? `Connected as ${me.email || me.name || "Calendly"}. ${webhook.detail}`
        : `Connected as ${me.email || me.name || "Calendly"}, but webhook failed: ${webhook.error || webhook.detail}`,
    });
  }

  if (action === "disconnect") {
    await clearCalendlyIntegration();
    return NextResponse.json({
      ...(await statusPayload()),
      detail: "Removed the stored Calendly token. Vercel env tokens are unchanged.",
    });
  }

  if (action === "sync") {
    const email = body.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }
    const result = await syncCalendlyBookingForEmail(email);
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  }

  if (action === "backfill") {
    const result = await backfillCalendlyBookings();
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  }

  if (action === "ensure-webhook") {
    const ensured = await ensureCalendlyWebhookForApp();
    if (!ensured.ok) {
      return NextResponse.json({ ok: false, error: ensured.error || ensured.detail }, { status: 502 });
    }
    return NextResponse.json({
      ok: true,
      created: ensured.created,
      callbackUrl: ensured.callbackUrl,
      detail: ensured.detail,
      // Never send the signing key to the browser — it is stored server-side.
    });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
