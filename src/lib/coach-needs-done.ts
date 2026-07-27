import "server-only";

import { listSelfRegisteredAccounts } from "@/lib/member-accounts-store";
import { listMemberProfiles } from "@/lib/member-profiles-store";
import { signupPlanLabel } from "@/lib/signup-plans";
import { isDemoMode } from "@/lib/demo-enrollments";
import { isDatabaseConfigured } from "@/lib/database-config";

export type NeedsDoneStepId =
  | "signed_up"
  | "paid"
  | "onboarding"
  | "equipment"
  | "start_date"
  | "messages"
  | "intro"
  | "first_workout";

export type NeedsDoneStep = {
  id: NeedsDoneStepId;
  label: string;
  done: boolean;
  at: string | null;
  detail: string | null;
};

export type NeedsDoneMember = {
  userId: string;
  email: string;
  name: string;
  plan: string;
  planLabel: string;
  phone: string | null;
  steps: NeedsDoneStep[];
  /** 0–100 */
  progressPercent: number;
  openCount: number;
  nextAction: string | null;
  deepLink: string;
};

const STEP_LABELS: Record<NeedsDoneStepId, string> = {
  signed_up: "Signed up",
  paid: "Paid / free ticket",
  onboarding: "Finished onboarding",
  equipment: "Home equipment",
  start_date: "Program start date",
  messages: "Opened Messages",
  intro: "Intro call booked / intake",
  first_workout: "First workout logged",
};

function isPaidPlan(plan: string): boolean {
  return plan === "member" || plan === "pro" || plan === "business";
}

function pct(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((done / total) * 100);
}

/**
 * Shared “needs done” board for coaches — computed from durable member state
 * (no separate task table). Newest members first; open items bubble up.
 */
export async function listCoachNeedsDone(opts?: {
  limit?: number;
  openOnly?: boolean;
}): Promise<NeedsDoneMember[]> {
  const limit = Math.min(100, Math.max(1, opts?.limit ?? 40));
  const openOnly = opts?.openOnly !== false;

  const [accounts, profiles] = await Promise.all([
    listSelfRegisteredAccounts(),
    listMemberProfiles(),
  ]);
  const profileByUserId = new Map(profiles.map((p) => [p.userId, p]));

  const userIds = accounts.map((a) => a.account.userId);
  const equipmentByUser = new Map<string, { count: number; updatedAt: string | null }>();
  const startByUser = new Map<string, string | null>();
  const workoutByUser = new Map<string, string | null>();
  const messagesOpened = new Set<string>();

  if (isDatabaseConfigured() && !isDemoMode() && userIds.length) {
    try {
      const { prisma } = await import("@/lib/prisma");
      const [equip, enrollments, logs, claims] = await Promise.all([
        prisma.userEquipment.findMany({
          where: { userId: { in: userIds }, hasAtHome: true },
          select: { userId: true },
        }),
        prisma.programEnrollment.findMany({
          where: { userId: { in: userIds } },
          select: { userId: true, programStartDate: true },
        }),
        prisma.workoutLog.findMany({
          where: { userId: { in: userIds } },
          orderBy: { performedAt: "asc" },
          select: { userId: true, performedAt: true },
        }),
        prisma.outboundNotification.findMany({
          where: {
            userId: { in: userIds },
            category: "coach-once:messages-opened",
            status: "sent",
          },
          select: { userId: true },
        }),
      ]);

      for (const e of equip) {
        const cur = equipmentByUser.get(e.userId) || { count: 0, updatedAt: null };
        cur.count += 1;
        equipmentByUser.set(e.userId, cur);
      }
      for (const en of enrollments) {
        const iso = en.programStartDate
          ? en.programStartDate instanceof Date
            ? en.programStartDate.toISOString().slice(0, 10)
            : String(en.programStartDate).slice(0, 10)
          : null;
        if (iso && !startByUser.get(en.userId)) startByUser.set(en.userId, iso);
      }
      for (const log of logs) {
        if (!workoutByUser.has(log.userId)) {
          workoutByUser.set(log.userId, log.performedAt.toISOString());
        }
      }
      for (const c of claims) {
        if (c.userId) messagesOpened.add(c.userId);
      }
    } catch (e) {
      console.warn("[needs-done] db enrichment failed", e);
    }
  }

  const rows: NeedsDoneMember[] = [];

  for (const { email, account } of accounts) {
    const profile = profileByUserId.get(account.userId);
    if (!profile) continue;

    const plan = profile.plan;
    const paidOk =
      !isPaidPlan(plan) ||
      profile.paymentStatus === "paid" ||
      profile.paymentStatus === "none";

    const equip = equipmentByUser.get(account.userId);
    const startIso = startByUser.get(account.userId) ?? null;
    const firstWorkout = workoutByUser.get(account.userId) ?? null;
    const introOk = Boolean(
      profile.introBookedAt ||
        profile.coachIntakeCompleteAt ||
        profile.coachMeetingRequestedAt,
    );
    const msgsOk = messagesOpened.has(account.userId);

    const steps: NeedsDoneStep[] = [
      {
        id: "signed_up",
        label: STEP_LABELS.signed_up,
        done: true,
        at: account.createdAt || null,
        detail: null,
      },
      {
        id: "paid",
        label: STEP_LABELS.paid,
        done: paidOk,
        at: profile.paidAt || null,
        detail: isPaidPlan(plan)
          ? profile.paymentStatus === "paid"
            ? profile.paymentMethod || "paid"
            : `status: ${profile.paymentStatus}`
          : "Explorer / free",
      },
      {
        id: "onboarding",
        label: STEP_LABELS.onboarding,
        done: Boolean(profile.onboardingComplete),
        at: profile.completedAt || null,
        detail: null,
      },
      {
        id: "equipment",
        label: STEP_LABELS.equipment,
        done: Boolean(equip && equip.count > 0),
        at: equip?.updatedAt ?? null,
        detail: equip?.count ? `${equip.count} items at home` : null,
      },
      {
        id: "start_date",
        label: STEP_LABELS.start_date,
        done: Boolean(startIso),
        at: startIso,
        detail: startIso ? `Day 1: ${startIso}` : null,
      },
      {
        id: "messages",
        label: STEP_LABELS.messages,
        done: msgsOk,
        at: null,
        detail: null,
      },
      {
        id: "intro",
        label: STEP_LABELS.intro,
        done: introOk,
        at:
          profile.introBookedAt ||
          profile.coachIntakeCompleteAt ||
          profile.coachMeetingRequestedAt ||
          null,
        detail: profile.coachIntakeCompleteAt
          ? "Intake signed"
          : profile.introBookedAt
            ? "Intro booked"
            : profile.coachMeetingRequestedAt
              ? "Meeting requested"
              : null,
      },
      {
        id: "first_workout",
        label: STEP_LABELS.first_workout,
        done: Boolean(firstWorkout),
        at: firstWorkout,
        detail: null,
      },
    ];

    const doneCount = steps.filter((s) => s.done).length;
    const openCount = steps.length - doneCount;
    if (openOnly && openCount === 0) continue;

    const next = steps.find((s) => !s.done);
    rows.push({
      userId: account.userId,
      email,
      name: account.name || email.split("@")[0] || "Member",
      plan,
      planLabel: signupPlanLabel(plan),
      phone: profile.phone || account.phone || null,
      steps,
      progressPercent: pct(doneCount, steps.length),
      openCount,
      nextAction: next ? next.label : null,
      deepLink: `/admin/chat?member=${encodeURIComponent(account.userId)}`,
    });
  }

  rows.sort((a, b) => {
    if (b.openCount !== a.openCount) return b.openCount - a.openCount;
    const aAt = a.steps[0]?.at || "";
    const bAt = b.steps[0]?.at || "";
    return bAt.localeCompare(aAt);
  });

  return rows.slice(0, limit);
}
