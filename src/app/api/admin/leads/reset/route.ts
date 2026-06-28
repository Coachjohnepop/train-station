import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { clearWaitlist, addToWaitlist, listLeads } from "@/lib/waitlist";
import { clearSelfRegisteredAccounts, registerMember } from "@/lib/member-accounts-store";
import { ensureMemberProfile, removeMemberProfiles } from "@/lib/member-profiles-store";
import { enrollDemo } from "@/lib/demo-enrollments";
import { normalizeSignupPlan } from "@/lib/signup-plans";

export const dynamic = "force-dynamic";

const seedSchema = z
  .object({
    email: z.string().email(),
    firstName: z.string().min(1).max(60),
    lastName: z.string().min(1).max(60),
    phone: z.string().max(30).optional(),
    plan: z.string().max(40).optional(),
  })
  .optional();

const bodySchema = z.object({
  seed: seedSchema,
});

async function requireStaff() {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) return null;
  return session;
}

export async function POST(request: Request) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Coach sign-in required." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  await clearWaitlist();
  const { removedEmails, removedUserIds } = await clearSelfRegisteredAccounts();
  const profilesRemoved = await removeMemberProfiles(removedUserIds);

  let seeded: { email: string; name: string; userId: string } | null = null;
  const seed = parsed.data.seed;
  if (seed) {
    const plan = normalizeSignupPlan(seed.plan);
    const account = await registerMember({
      email: seed.email,
      firstName: seed.firstName,
      lastName: seed.lastName,
      phone: seed.phone,
      plan,
    });

    await ensureMemberProfile({
      userId: account.userId,
      email: seed.email.trim().toLowerCase(),
      plan,
      phone: seed.phone || null,
    });

    await enrollDemo("adult", account.userId);

    await addToWaitlist({
      email: seed.email,
      firstName: seed.firstName,
      lastName: seed.lastName,
      phone: seed.phone || null,
      plan,
      source: "signup-register",
    });

    seeded = {
      email: seed.email.trim().toLowerCase(),
      name: account.name,
      userId: account.userId,
    };
  }

  const leads = await listLeads();

  return NextResponse.json({
    ok: true,
    cleared: {
      waitlist: true,
      registeredAccounts: removedEmails.length,
      profiles: profilesRemoved,
    },
    removedEmails,
    seeded,
    leadCount: leads.length,
    leads,
  });
}