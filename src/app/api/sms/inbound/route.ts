import { NextResponse } from "next/server";
import twilio from "twilio";
import { appendMemberSmsToChat } from "@/lib/coach-chat";
import { findUserByPhone, logInboundMemberSms, twilioConfigured } from "@/lib/sms";
import {
  deliverSmsAudited,
  setUserSmsOptIn,
  setUserSmsOptOut,
} from "@/lib/sms-delivery";
import { recordAuditEvent } from "@/lib/audit-event";

const STOP_KEYWORDS = new Set([
  "STOP",
  "STOPALL",
  "UNSUBSCRIBE",
  "CANCEL",
  "END",
  "QUIT",
]);
const START_KEYWORDS = new Set(["START", "YES", "UNSTOP"]);
const HELP_KEYWORDS = new Set(["HELP", "INFO"]);

function validateTwilioSignature(
  request: Request,
  params: Record<string, string>,
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!authToken) return true;

  const signature = request.headers.get("x-twilio-signature");
  if (!signature) return false;

  const webhookUrl =
    process.env.TWILIO_INBOUND_WEBHOOK_URL?.trim() ||
    process.env.TWILIO_WEBHOOK_URL?.trim() ||
    request.url;

  return twilio.validateRequest(authToken, signature, webhookUrl, params);
}

function twimlResponse(message?: string) {
  if (message) {
    const escaped = message
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return new NextResponse(`<Response><Message>${escaped}</Message></Response>`, {
      headers: { "Content-Type": "text/xml" },
    });
  }
  return new NextResponse("<Response></Response>", {
    headers: { "Content-Type": "text/xml" },
  });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  let from = "";
  let body = "";
  let formParams: Record<string, string> | null = null;

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const form = await request.formData();
    formParams = {};
    for (const [key, value] of form.entries()) {
      formParams[key] = String(value);
    }
    from = formParams.From || "";
    body = (formParams.Body || "").trim();
  } else {
    try {
      const json = await request.json();
      from = String(json.From || json.from || "");
      body = String(json.Body || json.body || "").trim();
      if (twilioConfigured()) {
        return NextResponse.json(
          { error: "JSON payloads not accepted when Twilio is configured" },
          { status: 400 },
        );
      }
    } catch {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
  }

  if (twilioConfigured() && formParams && !validateTwilioSignature(request, formParams)) {
    console.warn("Inbound SMS rejected: invalid Twilio signature");
    await recordAuditEvent({
      action: "sms.inbound",
      outcome: "denied",
      metadata: { reason: "invalid_signature" },
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  if (!from || !body) {
    return twimlResponse();
  }

  const keyword = body.trim().toUpperCase();
  const user = await findUserByPhone(from);

  // Always durable-log inbound when we can attribute (or as unknown)
  if (user) {
    const log = await logInboundMemberSms({
      userId: user.id,
      phone: from,
      message: body,
    });

    if (STOP_KEYWORDS.has(keyword)) {
      await setUserSmsOptOut({ userId: user.id, phone: from, source: "keyword" });
      return twimlResponse(
        "You are unsubscribed from The Train Station texts. Reply START to re-subscribe.",
      );
    }

    if (START_KEYWORDS.has(keyword)) {
      await setUserSmsOptIn({ userId: user.id, phone: from, source: "keyword" });
      return twimlResponse(
        "You are re-subscribed to The Train Station texts. Reply STOP to unsubscribe.",
      );
    }

    if (HELP_KEYWORDS.has(keyword)) {
      return twimlResponse(
        "The Train Station coaching texts. Reply STOP to unsubscribe. Help: support@thetrainstation.co",
      );
    }

    await appendMemberSmsToChat({
      memberId: user.id,
      body,
      phone: from,
      smsLogId: log.smsLogId,
    });

    return twimlResponse();
  }

  // Unknown number — still audit for diligence; no chat thread
  console.warn("Inbound SMS from unknown phone", from);
  await deliverSmsAudited({
    phone: from,
    message: body,
    userId: null,
    source: "member-reply-unknown",
    direction: "inbound",
    recordOnly: true,
    metadata: { unknownMember: true, keyword },
  });
  await recordAuditEvent({
    action: "sms.inbound",
    outcome: "info",
    entityType: "Phone",
    entityId: from,
    metadata: { unknownMember: true, bodyPreview: body.slice(0, 80) },
  });

  return twimlResponse();
}
