import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { getHubRecipients, messageHubActive } from "@/lib/message-hub";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const recipients = await getHubRecipients();
  return NextResponse.json({
    recipients,
    hubActive: messageHubActive(),
    channel: messageHubActive() ? "email" : "sms",
  });
}