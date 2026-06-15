import { NextResponse } from "next/server";
import { authenticateCredentials, applySessionCookies, isStaffRole } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json();
  const email = String(body.email || "");
  const password = String(body.password || "");
  const redirect = typeof body.redirect === "string" ? body.redirect : "";

  const user = await authenticateCredentials(email, password);
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  let destination = isStaffRole(user.role) ? "/admin" : "/member";
  if (redirect && redirect.startsWith("/") && !redirect.startsWith("//")) {
    if (isStaffRole(user.role) && redirect.startsWith("/admin")) destination = redirect;
    else if (!isStaffRole(user.role) && redirect.startsWith("/member")) destination = redirect;
    else if (redirect.startsWith("/member/chat")) destination = redirect;
  }

  const res = NextResponse.json({ ok: true, user: { email: user.email, name: user.name, role: user.role }, redirect: destination });
  applySessionCookies(res, user);
  return res;
}