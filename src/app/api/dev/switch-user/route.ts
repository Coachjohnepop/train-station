import { NextResponse } from "next/server";
import { MEMBER_COOKIE, MEMBER_NAME_COOKIE } from "@/lib/current-user";
import { resolveDemoUser } from "@/lib/demo-user-directory";

const ALLOWED = new Set([
  "demo-user",
  "demo-user-john",
  "demo-user-stephanie",
  "demo-user-2",
]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") || "demo-user";
  const redirectTo = searchParams.get("redirect") || "/member";

  if (!ALLOWED.has(id)) {
    return NextResponse.json({ error: "Unknown demo user" }, { status: 400 });
  }

  const user = resolveDemoUser(id);
  const res = NextResponse.redirect(new URL(redirectTo, request.url));
  res.cookies.set(MEMBER_COOKIE, id, { path: "/", maxAge: 60 * 60 * 24 * 30 });
  res.cookies.set(MEMBER_NAME_COOKIE, user?.name || "Member", { path: "/", maxAge: 60 * 60 * 24 * 30 });
  return res;
}