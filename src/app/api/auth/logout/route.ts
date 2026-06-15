import { NextResponse } from "next/server";
import { clearSessionCookies } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearSessionCookies(res);
  return res;
}

export async function GET(request: Request) {
  const res = NextResponse.redirect(new URL("/login", request.url));
  clearSessionCookies(res);
  return res;
}