import { NextResponse } from "next/server";
import { appendMemberSmsToChat } from "@/lib/coach-chat";
import { findUserByPhone, logInboundMemberSms } from "@/lib/sms";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  let from = "";
  let body = "";

  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    from = String(form.get("From") || "");
    body = String(form.get("Body") || "").trim();
  } else {
    try {
      const json = await request.json();
      from = String(json.From || json.from || "");
      body = String(json.Body || json.body || "").trim();
    } catch {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
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