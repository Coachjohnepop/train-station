import "server-only";

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { applySessionCookies } from "@/lib/auth";
import { applyByowCookie } from "@/lib/complete-member-signup";
import { buildByowWorkoutFromNotes } from "@/lib/byow-build";
import { enrollUserInProgram } from "@/lib/data/user-data";
import { NextResponse } from "next/server";

export const GUEST_EMAIL_DOMAIN = "guest.thetrainstation.co";

const RESERVED = new Set(
  [
    "jeremy",
    "coach",
    "admin",
    "john",
    "todd",
    "ali",
    "stephanie",
    "thetrainstation",
    "byrd",
  ].map((s) => s.toLowerCase()),
);

export function normalizeByowUsername(raw: string): string {
  return raw.trim().replace(/\s+/g, "_");
}

export function validateByowUsername(raw: string): string | null {
  const u = normalizeByowUsername(raw);
  if (u.length < 3 || u.length > 24) return "Username must be 3–24 characters.";
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(u)) {
    return "Start with a letter. Letters, numbers, and underscores only.";
  }
  if (RESERVED.has(u.toLowerCase())) return "That name is reserved.";
  return null;
}

export async function usernameTaken(username: string): Promise<boolean> {
  const u = normalizeByowUsername(username);
  const hit = await prisma.user.findFirst({
    where: { name: { equals: u, mode: "insensitive" } },
    select: { id: true },
  });
  return Boolean(hit);
}

export async function startByowGuest(input: {
  username: string;
  path: "own" | "jeremy";
  rawText?: string;
}): Promise<{
  userId: string;
  username: string;
  workoutId?: string;
  redirectTo: string;
  applyCookies: (res: NextResponse) => void;
}> {
  const err = validateByowUsername(input.username);
  if (err) throw new Error(err);
  const username = normalizeByowUsername(input.username);
  if (await usernameTaken(username)) {
    throw new Error("That username is taken. Try another.");
  }
  if (input.path === "own" && !input.rawText?.trim()) {
    throw new Error("Paste today’s workout, then tap Ingest.");
  }

  const id = `member-${randomUUID().slice(0, 12)}`;
  const email = `guest.${username.toLowerCase()}.${id.slice(-8)}@${GUEST_EMAIL_DOMAIN}`;
  const trialEnds = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.user.create({
    data: {
      id,
      email,
      name: username,
      role: "MEMBER",
      passwordHash: null,
    },
  });
  await prisma.memberProfile.create({
    data: {
      userId: id,
      email,
      plan: "explorer",
      paymentStatus: "paid",
      paymentMethod: "manual",
      paymentNote: "byow",
      paidAt: new Date(),
      onboardingComplete: true,
      completedAt: new Date(),
      approvalStatus: "approved",
      approvedAt: new Date(),
      byowTrialEndsAt: trialEnds,
    },
  });

  let workoutId: string | undefined;
  let redirectTo = "/member/today";
  if (input.path === "own" && input.rawText) {
    const built = await buildByowWorkoutFromNotes({
      ownerUserId: id,
      rawText: input.rawText,
    });
    workoutId = built.workoutId;
    redirectTo = `/member/workout?byow=${encodeURIComponent(workoutId)}`;
  } else {
    await enrollUserInProgram("adult", id);
    redirectTo = "/member/today";
  }

  return {
    userId: id,
    username,
    workoutId,
    redirectTo,
    applyCookies: (res) => {
      applySessionCookies(res, {
        id,
        email,
        name: username,
        role: "MEMBER",
      });
      applyByowCookie(res);
    },
  };
}
