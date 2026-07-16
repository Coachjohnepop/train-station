import { NextResponse } from "next/server";
import twilio from "twilio";
import { applyTwilioStatusCallback } from "@/lib/sms-delivery";
import { twilioConfigured } from "@/lib/sms-phone";

export const dynamic = "force-dynamic";

function validateTwilioSignature(
  request: Request,
  params: Record<string, string>,
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!authToken) return true;

  const signature = request.headers.get("x-twilio-signature");
  if (!signature) return false;

  const webhookUrl =
    process.env.TWILIO_STATUS_CALLBACK_URL?.trim() ||
    process.env.TWILIO_INBOUND_WEBHOOK_URL?.trim()?.replace(/\/inbound\/?$/, "/status") ||
    request.url;

  return twilio.validateRequest(authToken, signature, webhookUrl, params);
}

/**
 * Twilio Message status callback — updates SmsLog + SmsDeliveryEvent + AuditEvent.
 * Configure TWILIO_STATUS_CALLBACK_URL or rely on NEXT_PUBLIC_APP_URL/api/sms/status
 * set on send.
 */
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  let formParams: Record<string, string> = {};

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const form = await request.formData();
    for (const [key, value] of form.entries()) {
      formParams[key] = String(value);
    }
  } else {
    try {
      const json = await request.json();
      formParams = Object.fromEntries(
        Object.entries(json).map(([k, v]) => [k, String(v ?? "")]),
      );
    } catch {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
  }

  if (twilioConfigured() && !validateTwilioSignature(request, formParams)) {
    console.warn("SMS status callback rejected: invalid Twilio signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const messageSid = formParams.MessageSid || formParams.SmsSid || "";
  const messageStatus = formParams.MessageStatus || formParams.SmsStatus || "";
  const errorCode = formParams.ErrorCode || null;

  if (!messageSid || !messageStatus) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const result = await applyTwilioStatusCallback({
    messageSid,
    messageStatus,
    errorCode,
    rawPayload: formParams,
  });

  return NextResponse.json({ ok: true, ...result });
}
