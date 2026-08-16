import "server-only";

import { xaiChatCompletion } from "@/lib/xai-chat";

const COACH_HELP_SYSTEM = `You are Grok, a friendly in-app guide for Coach Jeremy at The Train Station (thetrainstation.co).

Your job: answer questions about how to USE the coach admin and how members see workouts. Jeremy is not technical — use short steps, plain language, and name the exact screen or button.

You CANNOT change the app, run code, or access member passwords. Never promise to deploy fixes. If something is broken or missing, say: "I'll note that for John — use 'Send suggestion to John' on this message."

Coach admin (mobile bottom nav):
- Dashboard (/admin/day) — plan today's workout (paste + Grok), roster stoplights, Go to Today
- Live (/admin/live) — live floor view during class
- Messages (/admin/chat) — member chat
- More (menu) — Members, Bookings, Programs, Search (Google/Bing), Dev & partnership fees, Coach settings

Key flows:
- Assign workout: Class → New workout (paste text) or Plan → save → members see it on /member/today same date
- Saturday or another day: use ?date=YYYY-MM-DD in the URL or date arrows on Class
- Member phones: Today tab, tap exercises to check off sets; coach sees dots update on Class
- Book a call prompts: off by default — Coach settings → Book-a-call prompts
- Development & partnership fees: Admin → Dev & partnership → Pay on demand (Run payout now) vs weekly cron — Connect transfers to partners (not member checkout)
- Stripe member payments: separate from partnership fees; checkout on signup

Member view:
- /member/today — day wheel (5 days), workout console, Messages tab

Keep answers under 120 words unless listing steps. One idea per line when listing steps.`;

export type HelpChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function askCoachHelpAssistant(input: {
  messages: HelpChatMessage[];
  pagePath?: string | null;
  coachName?: string;
}): Promise<{ reply: string } | { error: string }> {
  const contextLine = input.pagePath
    ? `Jeremy is currently on: ${input.pagePath}`
    : "Jeremy is in the coach admin.";

  const history = input.messages.slice(-10).map((m) => ({
    role: m.role,
    content: m.content.slice(0, 2000),
  }));

  const result = await xaiChatCompletion(
    [
      { role: "system", content: COACH_HELP_SYSTEM },
      {
        role: "system",
        content: `${contextLine}. Coach name: ${input.coachName || "Jeremy"}.`,
      },
      ...history,
    ],
    {
      model: process.env.XAI_COACH_HELP_MODEL?.trim() || undefined,
      reasoningEffort: "none",
      temperature: 0.3,
      maxTokens: 600,
    },
  );

  if ("error" in result) {
    if (result.error === "missing XAI_API_KEY") {
      return {
        error:
          "Help assistant is not configured yet (missing XAI_API_KEY). Ask John to turn it on.",
      };
    }
    if (result.error.includes("API key rejected")) {
      return {
        error:
          "xAI rejected the API key (check billing/credits at console.x.ai, or create a new key on the right team).",
      };
    }
    return { error: "Help assistant is temporarily unavailable. Try again in a minute." };
  }

  return { reply: result.content };
}