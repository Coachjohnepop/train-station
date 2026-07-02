import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { askCoachHelpAssistant } from "@/lib/coach-help-assistant";
import {
  canUseCoachHelpAssistant,
  isCoachHelpConfigured,
} from "@/lib/coach-help-access";
import { appendCoachHelpSuggestion } from "@/lib/coach-help-suggestions-store";
import { probeXaiApi } from "@/lib/xai-chat";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  message: z.string().min(1).max(2000),
  pagePath: z.string().max(200).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .max(12)
    .optional(),
  sendSuggestionToJohn: z.boolean().optional(),
});

export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ enabled: false, configured: false });
  }
  const firstName =
    session.name?.trim().split(/\s+/)[0] ||
    session.email?.split("@")[0] ||
    "Coach";

  const url = new URL(request.url);
  if (url.searchParams.get("probe") === "1" && session.role === "ADMIN") {
    const probe = await probeXaiApi();
    return NextResponse.json({
      configured: isCoachHelpConfigured(),
      probe,
    });
  }

  return NextResponse.json({
    enabled: canUseCoachHelpAssistant(session),
    configured: isCoachHelpConfigured(),
    label: "Ask Grok",
    coachName: firstName,
  });
}

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session || !canUseCoachHelpAssistant(session)) {
    return NextResponse.json({ error: "Help assistant is not available for this account." }, { status: 403 });
  }

  const parsed = postSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a question (up to 2000 characters)." }, { status: 400 });
  }

  const history = parsed.data.history ?? [];
  const result = await askCoachHelpAssistant({
    messages: [...history, { role: "user", content: parsed.data.message }],
    pagePath: parsed.data.pagePath,
    coachName: session.name,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 503 });
  }

  let suggestionSaved = false;
  if (parsed.data.sendSuggestionToJohn) {
    await appendCoachHelpSuggestion({
      coachEmail: session.email,
      coachName: session.name || "Coach",
      pagePath: parsed.data.pagePath,
      userMessage: parsed.data.message,
      assistantReply: result.reply,
    });
    suggestionSaved = true;
  }

  return NextResponse.json({
    reply: result.reply,
    suggestionSaved,
  });
}