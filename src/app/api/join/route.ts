import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isDemoMode, enrollDemo } from "@/lib/demo-enrollments";
import { randomUUID } from "crypto";
import { MEMBER_COOKIE, MEMBER_NAME_COOKIE } from "@/lib/current-user";
import { isInvitedAccountEmail } from "@/lib/invited-accounts";
import { addToWaitlist } from "@/lib/waitlist";
import { isSecurityEnforced } from "@/lib/security-config";
import { getSessionUser } from "@/lib/auth";

const joinSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  email: z.string().email().optional(),
  plan: z.string().optional(), // explorer | member | pro
  programSlug: z.string().optional(), // auto-enroll this
});

function makeSyntheticId(): string {
  return "u_" + randomUUID().replace(/-/g, "").slice(0, 16);
}

import { DEFAULT_DEMO_MEMBER_ID } from "@/lib/demo-coach";

const DEMO_EMAIL_TO_ID: Record<string, string> = {
  "johnsteph@thetrainstation.co": DEFAULT_DEMO_MEMBER_ID,
  "chad@thetrainstation.co": "demo-user-john",
  "kaite@thetrainstation.co": "demo-user-stephanie",
  "stephanie@thetrainstation.co": "demo-user-stephanie",
  "demo@thetrainstation.co": "demo-user",
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = joinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: "Invalid input" }, { status: 400 });
  }

  const { name = "New Member", email, plan, programSlug = "adult" } = parsed.data;

  const normalizedEmail = email?.trim().toLowerCase();

  // Real guests → waitlist + coming soon (no app access yet)
  if (!normalizedEmail || !(await isInvitedAccountEmail(normalizedEmail))) {
    if (!normalizedEmail) {
      return NextResponse.json({ waitlist: true, redirectTo: "/signup" });
    }
    const nameParts = (name || "").trim().split(/\s+/).filter(Boolean);
    const entry = await addToWaitlist({
      email: normalizedEmail,
      firstName: nameParts.shift(),
      lastName: nameParts.join(" ") || undefined,
      plan: plan || null,
      source: "join-flow",
    });
    const params = new URLSearchParams({ email: entry.email, name: entry.name });
    return NextResponse.json({
      success: true,
      waitlist: true,
      redirectTo: `/coming-soon?${params.toString()}`,
    });
  }

  let userId: string;
  let userName = name;
  let userEmail = email || `member-${Date.now()}@thetrainstation.local`;

  const demo = isDemoMode();

  if (!demo) {
    try {
      // Try real create (will use the existing /api/users logic shape)
      const created = await prisma.user.create({
        data: {
          email: userEmail,
          name: userName,
          role: "MEMBER",
          status: "active",
        },
      });
      userId = created.id;
      userEmail = created.email;
      userName = created.name || userName;
    } catch (e: any) {
      // Duplicate email or other issue -> try find by email, else synthetic
      if (e.code === "P2002") {
        const existing = await prisma.user.findUnique({ where: { email: userEmail } });
        if (existing) {
          userId = existing.id;
          userName = existing.name || userName;
        } else {
          userId = makeSyntheticId();
        }
      } else {
        userId = makeSyntheticId();
      }
    }
  } else {
    const mapped = email ? DEMO_EMAIL_TO_ID[email.toLowerCase().trim()] : undefined;
    userId = mapped || makeSyntheticId();
  }

  // If a programSlug provided (or default), enroll for this user
  if (programSlug) {
    try {
      if (demo) {
        await enrollDemo(programSlug, userId); // we'll extend to accept uid
      } else {
        // real path will be handled in updated enroll, but do direct here for join
        const prog = await prisma.program.findUnique({ where: { slug: programSlug } });
        if (prog) {
          const exists = await prisma.programEnrollment.findFirst({
            where: { userId, programId: prog.id },
          });
          if (!exists) {
            await prisma.programEnrollment.create({
              data: {
                userId,
                programId: prog.id,
                startedAt: new Date(),
                currentWeek: 1,
                currentDay: 1,
              },
            });
          }
        }
      }
    } catch {
      // non fatal
    }
  }

  const session = await getSessionUser();
  const securityEnforced = isSecurityEnforced();

  // Production: never bootstrap identity via cookie — require a real session.
  if (securityEnforced && (!session || session.id !== userId)) {
    const loginParams = new URLSearchParams({ next: "/member/today" });
    if (userEmail) loginParams.set("email", userEmail);
    return NextResponse.json({
      success: true,
      userId,
      name: userName,
      redirectTo: `/login?${loginParams.toString()}`,
      requiresLogin: true,
    });
  }

  const res = NextResponse.json({
    success: true,
    userId,
    name: userName,
    redirectTo: "/member/today",
  });

  // Demo / dev only: cookie-backed identity for join flows without password.
  if (!securityEnforced) {
    res.cookies.set(MEMBER_COOKIE, userId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    res.cookies.set(MEMBER_NAME_COOKIE, userName.slice(0, 60), {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return res;
}
