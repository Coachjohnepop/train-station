import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo-enrollments";
import { hashAffiliatePassword } from "@/lib/affiliate/auth";
import { normalizeAffiliateCode } from "@/lib/affiliate/cookies";
import { DEFAULT_COMMISSION_RATE } from "@/lib/affiliate/commission";
import { acceptAffiliateInvite, readAffiliateInvite } from "@/lib/affiliate/invites";

export const dynamic = "force-dynamic";

const signupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  referralCode: z.string().max(24).optional(),
  inviteToken: z.string().min(20),
});

async function unusedCode(base: string): Promise<string> {
  let attempt = base.slice(0, 12) || "AFF";
  for (let i = 0; i < 12; i++) {
    const candidate = i === 0 ? attempt : `${attempt.slice(0, 10)}${i + 1}`;
    const taken = await prisma.affiliate.findUnique({
      where: { referralCode: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  return `AFF${Date.now().toString(36).toUpperCase()}`;
}

export async function POST(request: Request) {
  if (isDemoMode()) {
    return NextResponse.json({ error: "Affiliate signup needs the live database." }, { status: 503 });
  }
  const parsed = signupSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Name, email, and a password of at least 8 characters are required." },
      { status: 400 },
    );
  }

  const invite = await readAffiliateInvite(parsed.data.inviteToken);
  if (!invite.ok) return NextResponse.json({ error: invite.error }, { status: 400 });
  const email = invite.email;
  if (parsed.data.email.trim().toLowerCase() !== email) {
    return NextResponse.json({ error: "Use the email this invite was sent to." }, { status: 400 });
  }
  const existing = await prisma.affiliate.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ error: "An affiliate account with this email already exists." }, { status: 400 });
  }

  let referralCode = normalizeAffiliateCode(parsed.data.referralCode);
  if (parsed.data.referralCode?.trim() && (referralCode.length < 3 || referralCode.length > 16)) {
    return NextResponse.json({ error: "Referral code must be 3 to 16 letters or numbers." }, { status: 400 });
  }
  if (referralCode) {
    const taken = await prisma.affiliate.findUnique({
      where: { referralCode },
      select: { id: true },
    });
    if (taken) {
      return NextResponse.json({ error: "That referral code is already taken." }, { status: 400 });
    }
  } else {
    const base = normalizeAffiliateCode(parsed.data.name.split(" ")[0] || "AFF").slice(0, 8) || "AFF";
    referralCode = await unusedCode(`${base}20`);
  }

  try {
    await prisma.affiliate.create({
      data: {
        name: parsed.data.name.trim() || invite.name,
        email,
        passwordHash: hashAffiliatePassword(parsed.data.password),
        referralCode,
        status: "ACTIVE",
        commissionRate: DEFAULT_COMMISSION_RATE,
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not create that account. Try a different code." }, { status: 400 });
  }
  await acceptAffiliateInvite(parsed.data.inviteToken);

  return NextResponse.json({
    ok: true,
    referralCode,
    message: "Account created. Sign in with the password you just chose.",
  });
}
