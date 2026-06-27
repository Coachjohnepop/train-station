import { NextResponse } from "next/server";
import { normalizeAccountEmail } from "@/lib/account-email";
import { authenticateCredentials } from "@/lib/auth";
import { buildLoginResponse } from "@/lib/complete-login";
import { isInvitedAccountEmail } from "@/lib/invited-accounts";

export async function POST(request: Request) {
  const body = await request.json();
  const email = String(body.email || "");
  const password = String(body.password || "");
  const redirect = typeof body.redirect === "string" ? body.redirect : "";

  const normalized = normalizeAccountEmail(email);
  if (!(await isInvitedAccountEmail(normalized))) {
    return NextResponse.json(
      {
        error: "No account found. Create one from the home page ticket picker.",
        code: "not_invited",
        signupUrl: `/signup?email=${encodeURIComponent(normalized)}`,
      },
      { status: 403 },
    );
  }

  const user = await authenticateCredentials(email, password);
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  return buildLoginResponse(user, { redirect });
}