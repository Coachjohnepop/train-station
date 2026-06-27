import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  applyEmailHistoryCookies,
  readEmailHistoryFromRequestCookies,
} from "@/lib/email-history-cookies";
import { requestPasswordReset } from "@/lib/password-reset";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const { message, emailed } = await requestPasswordReset(parsed.data.email);

  const cookieStore = await cookies();
  const res = NextResponse.json({ ok: true, message, emailed });
  applyEmailHistoryCookies(
    res,
    parsed.data.email,
    readEmailHistoryFromRequestCookies((name) => cookieStore.get(name)),
  );
  return res;
}