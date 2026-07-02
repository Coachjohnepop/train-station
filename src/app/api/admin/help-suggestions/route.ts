import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { canViewCoachHelpSuggestions } from "@/lib/coach-help-access";
import {
  countUnreadCoachHelpSuggestions,
  listCoachHelpSuggestions,
  markCoachHelpSuggestionRead,
} from "@/lib/coach-help-suggestions-store";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  id: z.string().min(1),
  read: z.literal(true),
});

export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session || !canViewCoachHelpSuggestions(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const countOnly = url.searchParams.get("count") === "1";

  if (countOnly) {
    const unread = await countUnreadCoachHelpSuggestions();
    return NextResponse.json({ unread });
  }

  const suggestions = await listCoachHelpSuggestions();
  return NextResponse.json({ suggestions, unread: suggestions.filter((s) => !s.readAt).length });
}

export async function PATCH(request: Request) {
  const session = await getSessionUser();
  if (!session || !canViewCoachHelpSuggestions(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const ok = await markCoachHelpSuggestionRead(parsed.data.id);
  if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}