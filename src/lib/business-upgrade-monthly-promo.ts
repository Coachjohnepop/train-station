import "server-only";

import { randomInt } from "node:crypto";
import { BRAND_NAME } from "@/lib/brand";
import {
  appendPaymentNote,
  isPayingCoachUpgradeEntrant,
  memberDisplayNameFromEmail,
  pickMonthlyPromoWinner,
} from "@/lib/business-upgrade";
import { isStandingStaffGrantEmail } from "@/lib/staff-grant-standing";
import { notifyBusinessUpgradeAdmins } from "@/lib/business-upgrade-request";
import { getAccountByUserId } from "@/lib/member-accounts-store";
import { listMemberProfiles, updateMemberProfile } from "@/lib/member-profiles-store";
import { isDatabaseConfigured } from "@/lib/database-config";
import { prisma } from "@/lib/prisma";
import { localTodayIso } from "@/lib/program-calendar";
import { sendResendEmail } from "@/lib/resend-mail";
import { staffGrantNotifyEmails } from "@/lib/staff-grants";

export type MonthlyPromoRecord = {
  monthKey: string;
  monthLabel: string;
  winnerUserId: string | null;
  winnerEmail: string | null;
  eligibleCount: number;
  drawnAt: string | null;
  drawnBy: string | null;
};

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://www.thetrainstation.co"
  );
}

export function pacificMonthKey(from = new Date()): string {
  return localTodayIso(from).slice(0, 7);
}

export function previousPacificMonthKey(from = new Date()): string {
  const [year, month] = pacificMonthKey(from).split("-").map(Number);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  return `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
}

export function monthKeyLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return monthKey;
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function isTimestampInPacificMonth(
  iso: string | null | undefined,
  monthKey: string,
): boolean {
  if (!iso) return false;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return false;
  return localTodayIso(parsed).startsWith(monthKey);
}

function toRecord(row: {
  monthKey: string;
  winnerUserId: string | null;
  winnerEmail: string | null;
  eligibleCount: number;
  drawnAt: Date | null;
  drawnBy: string | null;
}): MonthlyPromoRecord {
  return {
    monthKey: row.monthKey,
    monthLabel: monthKeyLabel(row.monthKey),
    winnerUserId: row.winnerUserId,
    winnerEmail: row.winnerEmail,
    eligibleCount: row.eligibleCount,
    drawnAt: row.drawnAt ? row.drawnAt.toISOString() : null,
    drawnBy: row.drawnBy,
  };
}

export async function loadMonthlyPromo(monthKey: string): Promise<MonthlyPromoRecord | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const row = await prisma.businessUpgradeMonthlyPromo.findUnique({
      where: { monthKey },
    });
    return row ? toRecord(row) : null;
  } catch (error) {
    console.warn(
      "[business-upgrade-promo] load failed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export async function countEligiblePayingRequests(monthKey: string): Promise<number> {
  const profiles = await listMemberProfiles();
  return profiles.filter(
    (profile) =>
      isPayingCoachUpgradeEntrant(profile) &&
      !isStandingStaffGrantEmail(profile.email) &&
      isTimestampInPacificMonth(profile.businessUpgradeRequestedAt, monthKey),
  ).length;
}

export async function drawMonthlyUpgradePromo(input: {
  monthKey: string;
  actor: string;
}): Promise<
  | { ok: true; alreadyDrawn: boolean; promo: MonthlyPromoRecord; winnerName: string | null }
  | { error: string; status: number }
> {
  if (!isDatabaseConfigured()) {
    return { error: "Database is not configured.", status: 503 };
  }
  if (!/^\d{4}-\d{2}$/.test(input.monthKey)) {
    return { error: "Choose a month like 2026-09.", status: 400 };
  }

  const existing = await prisma.businessUpgradeMonthlyPromo.findUnique({
    where: { monthKey: input.monthKey },
  });
  if (existing?.drawnAt) {
    return {
      ok: true,
      alreadyDrawn: true,
      promo: toRecord(existing),
      winnerName: null,
    };
  }

  const profiles = await listMemberProfiles();
  const eligible = profiles.filter(
    (profile) =>
      isPayingCoachUpgradeEntrant(profile) &&
      !isStandingStaffGrantEmail(profile.email) &&
      isTimestampInPacificMonth(profile.businessUpgradeRequestedAt, input.monthKey),
  );

  const winner = pickMonthlyPromoWinner(eligible, (count) => randomInt(count));
  const now = new Date();
  const note = winner
    ? `Monthly promo winner · ${monthKeyLabel(input.monthKey)} · complimentary Business Class (Coach billing unchanged)`
    : `Monthly promo · ${monthKeyLabel(input.monthKey)} · no paying Coach requests`;

  const saved = await prisma.businessUpgradeMonthlyPromo.upsert({
    where: { monthKey: input.monthKey },
    create: {
      monthKey: input.monthKey,
      winnerUserId: winner?.userId ?? null,
      winnerEmail: winner?.email ?? null,
      eligibleCount: eligible.length,
      drawnAt: now,
      drawnBy: input.actor,
      note,
    },
    update: {
      winnerUserId: winner?.userId ?? null,
      winnerEmail: winner?.email ?? null,
      eligibleCount: eligible.length,
      drawnAt: now,
      drawnBy: input.actor,
      note,
    },
  });

  if (!winner) {
    const membersUrl = `${appBaseUrl()}/admin/members`;
    for (const to of staffGrantNotifyEmails()) {
      await sendResendEmail({
        to,
        subject: `${monthKeyLabel(input.monthKey)} upgrade promo · no paying requests · ${BRAND_NAME}`,
        text: `${note}\n\nOpen Members: ${membersUrl}`,
        ctaUrl: membersUrl,
        ctaLabel: "Open Admin Members",
        tags: [
          { name: "category", value: "business-upgrade-promo" },
          { name: "event", value: "no-winner" },
        ],
      });
    }
    return { ok: true, alreadyDrawn: false, promo: toRecord(saved), winnerName: null };
  }

  const nowIso = now.toISOString();
  const updated = await updateMemberProfile(winner.userId, {
    plan: "business",
    businessUpgradeStatus: "approved",
    businessUpgradeReviewedAt: nowIso,
    businessUpgradeReviewedBy: `monthly-promo:${input.monthKey}`,
    paymentNote: appendPaymentNote(winner.paymentNote, note),
  });

  const account = await getAccountByUserId(winner.userId);
  const winnerName = memberDisplayNameFromEmail(updated.email, account?.account.name);

  await notifyBusinessUpgradeAdmins({
    event: "approved",
    memberName: winnerName,
    memberEmail: updated.email,
    actorEmail: input.actor,
    hasStripeSubscription: Boolean(updated.stripeSubscriptionId),
    note,
    extraLines: [
      `${monthKeyLabel(input.monthKey)} monthly promo winner (${eligible.length} paying requests).`,
      "Complimentary Business Class — Stripe Coach billing was not raised to $50/mo.",
    ],
  });

  const first = winnerName.split(/\s+/)[0] || "there";
  await sendResendEmail({
    to: updated.email,
    subject: `You won this month's Business Class upgrade · ${BRAND_NAME}`,
    text: [
      `Hey ${first},`,
      "",
      `You won ${monthKeyLabel(input.monthKey)}'s Business Class upgrade at ${BRAND_NAME}.`,
      "",
      "Live Zooms are on your ticket now. Your Coach Class billing stays as-is — this seat is on us.",
      "",
      "Jeremy",
    ].join("\n"),
    ctaUrl: `${appBaseUrl()}/member/account`,
    ctaLabel: "Open Account",
    tags: [
      { name: "category", value: "business-upgrade-promo" },
      { name: "event", value: "winner" },
    ],
  });

  return {
    ok: true,
    alreadyDrawn: false,
    promo: toRecord(saved),
    winnerName,
  };
}

export async function memberMonthlyPromoView(userId: string): Promise<{
  monthKey: string;
  monthLabel: string;
  eligible: boolean;
  drawn: boolean;
  iWon: boolean;
  eligibleCount: number;
}> {
  const monthKey = pacificMonthKey();
  const monthLabel = monthKeyLabel(monthKey);
  const empty = {
    monthKey,
    monthLabel,
    eligible: false,
    drawn: false,
    iWon: false,
    eligibleCount: 0,
  };
  if (!isDatabaseConfigured()) return empty;

  const previousKey = previousPacificMonthKey();
  const [promo, previous, profiles] = await Promise.all([
    loadMonthlyPromo(monthKey),
    loadMonthlyPromo(previousKey),
    listMemberProfiles(),
  ]);
  const me = profiles.find((profile) => profile.userId === userId) ?? null;
  const eligibleNow = profiles.filter(
    (profile) =>
      isPayingCoachUpgradeEntrant(profile) &&
      !isStandingStaffGrantEmail(profile.email) &&
      isTimestampInPacificMonth(profile.businessUpgradeRequestedAt, monthKey),
  ).length;

  return {
    monthKey,
    monthLabel,
    eligible: Boolean(
      me &&
        isPayingCoachUpgradeEntrant(me) &&
        !isStandingStaffGrantEmail(me.email) &&
        isTimestampInPacificMonth(me.businessUpgradeRequestedAt, monthKey),
    ),
    drawn: Boolean(promo?.drawnAt),
    iWon: promo?.winnerUserId === userId || previous?.winnerUserId === userId,
    eligibleCount: promo?.drawnAt ? promo.eligibleCount : eligibleNow,
  };
}
