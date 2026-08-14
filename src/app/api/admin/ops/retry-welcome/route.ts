import { NextResponse } from "next/server";
import { cronAuthorized, requirePlatformStaff } from "@/lib/api-auth";
import { getAccountByUserId } from "@/lib/member-accounts-store";
import { getMemberProfile } from "@/lib/member-profiles-store";
import { sendMemberWelcomeEmail } from "@/lib/member-welcome";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_EMAILS = ["fletcherboys@att.net", "bellaroyy03@gmail.com"];

/**
 * Re-send welcome-signup from the live Resend account.
 * Auth: platform staff session OR Bearer OPS_BOOTSTRAP_SECRET / CRON_SECRET / RESEND_RETRY_TOKEN.
 */
export async function POST(request: Request) {
  const staff = await requirePlatformStaff();
  const cronOk = cronAuthorized(request, [
    process.env.OPS_BOOTSTRAP_SECRET,
    process.env.CRON_SECRET,
    process.env.RESEND_RETRY_TOKEN,
  ]);
  if (!staff.ok && !cronOk) {
    if (!staff.ok) return staff.response;
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    emails?: string[];
    note?: string;
  };
  const emails = (body.emails?.length ? body.emails : DEFAULT_EMAILS)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);
  const note =
    body.note?.trim() || "IT fixed this, sorry for the duplicate.";

  const results: Array<{ email: string; ok: boolean; error?: string }> = [];
  for (const email of emails) {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, email: true, name: true },
    });
    if (!user) {
      results.push({ email, ok: false, error: "user_not_found" });
      continue;
    }
    const profile = await getMemberProfile(user.id);
    const account = await getAccountByUserId(user.id);
    const sent = await sendMemberWelcomeEmail({
      email: user.email,
      name: account?.account.name || user.name || user.email,
      plan: profile?.plan || "member",
      stage: "signup",
      note,
    });
    results.push({ email: user.email, ok: sent });
  }

  return NextResponse.json({
    ok: results.every((r) => r.ok),
    fromHint: process.env.RESEND_FROM || null,
    results,
  });
}
