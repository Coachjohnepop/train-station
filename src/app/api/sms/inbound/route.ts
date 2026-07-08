import { NextResponse } from "next/server";
import twilio from "twilio";
import { appendMemberSmsToChat } from "@/lib/coach-chat";
import { findUserByPhone, logInboundMemberSms, twilioConfigured } from "@/lib/sms";

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

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  let from = "";
  let body = "";
  let formParams: Record<string, string> | null = null;

  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
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
        return NextResponse.json({ error: "JSON payloads not accepted when Twilio is configured" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
  }

  if (twilioConfigured() && formParams && !validateTwilioSignature(request, formParams)) {
    console.warn("Inbound SMS rejected: invalid Twilio signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  if (!from || !body) {
    return twimlResponse();
  }

  const user = await findUserByPhone(from);
  if (!user) {
    console.warn("Inbound SMS from unknown phone", from);
    return twimlResponse();
  }

  const log = await logInboundMemberSms({
    userId: user.id,
    phone: from,
    message: body,
  });

  await appendMemberSmsToChat({
    memberId: user.id,
    body,
    phone: from,
    smsLogId: log.smsLogId,
  });

  return twimlResponse();
}

function twimlResponse() {
  return new NextResponse("<Response></Response>", {
    headers: { "Content-Type": "text/xml" },
  });
}