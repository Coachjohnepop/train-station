import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { normalizeAccountEmail } from "@/lib/account-email";
import { authenticateCredentials } from "@/lib/auth";
import { buildLoginResponse } from "@/lib/complete-login";
import {
  applyEmailHistoryCookies,
  readEmailHistoryFromRequestCookies,
} from "@/lib/email-history-cookies";
import { isInvitedAccountEmail } from "@/lib/invited-accounts";

export async function POST(request: Request) {
  const body = await request.json();
  const email = String(body.email || "");
  const password = String(body.password || "");
  const redirect = typeof body.redirect === "string" ? body.redirect : "";

  const normalized = normalizeAccountEmail(email);
  const cookieStore = await cookies();
  const existingHistory = readEmailHistoryFromRequestCookies((name) => cookieStore.get(name));

  if (!(await isInvitedAccountEmail(normalized))) {
    const res = NextResponse.json(
      {
        error: "No account found. Create one from the home page ticket picker.",
        code: "not_invited",
        signupUrl: `/signup?email=${encodeURIComponent(normalized)}`,
      },
      { status: 403 },
    );
    applyEmailHistoryCookies(res, email, existingHistory);
    return res;
  }

  const user = await authenticateCredentials(email, password);
  if (!user) {
    const res = NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    applyEmailHistoryCookies(res, email, existingHistory);
    return res;
  }

  return buildLoginResponse(user, { redirect });
}