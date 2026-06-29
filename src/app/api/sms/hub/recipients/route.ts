import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { getMessagingGateStatus } from "@/lib/messaging-gate";
import { getHubRecipients, messageHubActive } from "@/lib/message-hub";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const [recipients, messaging] = await Promise.all([
    getHubRecipients(),
    getMessagingGateStatus(),
  ]);
  const hubActive = messageHubActive() && messaging.enabled;
  return NextResponse.json({
    recipients,
    hubActive,
    messagingEnabled: messaging.enabled,
    messagingSource: messaging.source,
    channel: hubActive ? "email" : messaging.enabled ? "sms" : "paused",
  });
}