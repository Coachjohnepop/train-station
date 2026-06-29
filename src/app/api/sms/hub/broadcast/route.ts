import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/api-auth";
import { coachDisplayName } from "@/lib/demo-coach";
import { isOutboundMessagingEnabled } from "@/lib/messaging-gate";
import { sendHubBroadcast, messageHubActive } from "@/lib/message-hub";
import { sendSmsBroadcast } from "@/lib/sms";

const schema = z.object({
  userIds: z.array(z.string()).optional(),
  message: z.string().min(1).max(2000),
  category: z.enum(["fasted-cardio", "sleep", "exercise", "general"]).optional(),
  deepLink: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid broadcast request." }, { status: 400 });
  }

  const coachName = coachDisplayName(auth.session);

  if (!(await isOutboundMessagingEnabled())) {
    return NextResponse.json(
      {
        error:
          "Outbound messaging is paused. Turn it on in Admin → Coach settings, or set MESSAGING_ENABLED=true.",
      },
      { status: 503 },
    );
  }

  if (messageHubActive()) {
    const result = await sendHubBroadcast({
      userIds: parsed.data.userIds,
      message: parsed.data.message,
      category: parsed.data.category,
      coachName,
      deepLink: parsed.data.deepLink,
    });
    return NextResponse.json({
      ok: true,
      channel: result.channel,
      sent: result.sent,
      logs: result.logs,
    });
  }

  const legacy = await sendSmsBroadcast({
    userIds: parsed.data.userIds,
    message: parsed.data.message,
    category: parsed.data.category,
  });

  return NextResponse.json({
    ok: true,
    channel: "sms",
    sent: legacy.sent,
    logs: legacy.logs,
  });
}