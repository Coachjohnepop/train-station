import "server-only";

import type { MemberProfile as DbMemberProfile } from "@/generated/prisma/client";
import {
  normalizeApprovalStatus,
  normalizePaymentStatus,
} from "@/lib/member-gates";
import type { MemberProfile, MemberProfilePatch, PaymentMethod } from "@/lib/member-profiles-types";
import { prisma } from "@/lib/prisma";
import { normalizeSignupPlan } from "@/lib/signup-plans";

type UserContactFields = {
  phone: string | null;
  dailyReminderTime: string | null;
  city: string | null;
  state: string | null;
};

function toIso(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString();
}

function parseOptionalDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizePaymentMethod(raw: string | null | undefined): PaymentMethod | null {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (
    v === "stripe" ||
    v === "venmo" ||
    v === "manual" ||
    v === "other" ||
    v === "card_on_file"
  ) {
    return v;
  }
  return null;
}

function rowToMemberProfile(
  row: DbMemberProfile,
  user: UserContactFields,
): MemberProfile {
  const plan = normalizeSignupPlan(row.plan);
  return {
    userId: row.userId,
    email: row.email,
    plan,
    phone: user.phone,
    dailyReminderTime: user.dailyReminderTime,
    weightLbs: row.weightLbs,
    notes: row.notes,
    city: user.city,
    state: user.state,
    onboardingComplete: row.onboardingComplete,
    completedAt: toIso(row.completedAt),
    approvalStatus: normalizeApprovalStatus(row.approvalStatus),
    approvedAt: toIso(row.approvedAt),
    paymentStatus: normalizePaymentStatus(row.paymentStatus, plan),
    paidAt: toIso(row.paidAt),
    paymentMethod: normalizePaymentMethod(row.paymentMethod),
    paymentNote: row.paymentNote,
    staffGrantExpiresAt: toIso(
      (row as DbMemberProfile & { staffGrantExpiresAt?: Date | null }).staffGrantExpiresAt,
    ),
    staffGrantedAt: toIso(
      (row as DbMemberProfile & { staffGrantedAt?: Date | null }).staffGrantedAt,
    ),
    staffGrantedBy:
      (row as DbMemberProfile & { staffGrantedBy?: string | null }).staffGrantedBy ?? null,
    stripeCustomerId: row.stripeCustomerId,
    stripeSubscriptionId: row.stripeSubscriptionId,
    stripeCheckoutSessionId: row.stripeCheckoutSessionId,
    referralCode: row.referralCode,
    referredByUserId: row.referredByUserId,
    intensiveSessionsTotal: row.intensiveSessionsTotal,
    intensiveSessionsRemaining: row.intensiveSessionsRemaining,
    intensiveWindowDays: row.intensiveWindowDays,
    intensiveStartsAt: toIso(row.intensiveStartsAt),
    intensiveExpiresAt: toIso(row.intensiveExpiresAt),
    customTrainingOfferId: row.customTrainingOfferId,
    welcomeSignupEmailSentAt: toIso(row.welcomeSignupEmailSentAt),
    welcomeCompleteEmailSentAt: toIso(row.welcomeCompleteEmailSentAt),
    welcomeSmsSentAt: toIso(row.welcomeSmsSentAt),
    coachIntakeCompleteAt: toIso(row.coachIntakeCompleteAt),
    coachIntakeCompletedBy: row.coachIntakeCompletedBy,
    introBookedAt: toIso(row.introBookedAt),
    coachMeetingRequestedAt: toIso(row.coachMeetingRequestedAt),
    coachMeetingRequestedBy: row.coachMeetingRequestedBy,
    coachMeetingRequestNote: row.coachMeetingRequestNote,
    rampStartedAt: toIso(row.rampStartedAt),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function profileToDbFields(profile: MemberProfile) {
  return {
    userId: profile.userId,
    email: profile.email,
    plan: profile.plan,
    weightLbs: profile.weightLbs,
    notes: profile.notes,
    onboardingComplete: profile.onboardingComplete,
    completedAt: parseOptionalDate(profile.completedAt) ?? null,
    approvalStatus: profile.approvalStatus,
    approvedAt: parseOptionalDate(profile.approvedAt) ?? null,
    paymentStatus: profile.paymentStatus,
    paidAt: parseOptionalDate(profile.paidAt) ?? null,
    paymentMethod: profile.paymentMethod,
    paymentNote: profile.paymentNote,
    staffGrantExpiresAt: parseOptionalDate(profile.staffGrantExpiresAt) ?? null,
    staffGrantedAt: parseOptionalDate(profile.staffGrantedAt) ?? null,
    staffGrantedBy: profile.staffGrantedBy,
    stripeCustomerId: profile.stripeCustomerId,
    stripeSubscriptionId: profile.stripeSubscriptionId,
    stripeCheckoutSessionId: profile.stripeCheckoutSessionId,
    referralCode: profile.referralCode,
    referredByUserId: profile.referredByUserId,
    intensiveSessionsTotal: profile.intensiveSessionsTotal,
    intensiveSessionsRemaining: profile.intensiveSessionsRemaining,
    intensiveWindowDays: profile.intensiveWindowDays,
    intensiveStartsAt: parseOptionalDate(profile.intensiveStartsAt) ?? null,
    intensiveExpiresAt: parseOptionalDate(profile.intensiveExpiresAt) ?? null,
    customTrainingOfferId: profile.customTrainingOfferId,
    welcomeSignupEmailSentAt: parseOptionalDate(profile.welcomeSignupEmailSentAt) ?? null,
    welcomeCompleteEmailSentAt: parseOptionalDate(profile.welcomeCompleteEmailSentAt) ?? null,
    welcomeSmsSentAt: parseOptionalDate(profile.welcomeSmsSentAt) ?? null,
    coachIntakeCompleteAt: parseOptionalDate(profile.coachIntakeCompleteAt) ?? null,
    coachIntakeCompletedBy: profile.coachIntakeCompletedBy,
    introBookedAt: parseOptionalDate(profile.introBookedAt) ?? null,
    coachMeetingRequestedAt: parseOptionalDate(profile.coachMeetingRequestedAt) ?? null,
    coachMeetingRequestedBy: profile.coachMeetingRequestedBy,
    coachMeetingRequestNote: profile.coachMeetingRequestNote,
    rampStartedAt: parseOptionalDate(profile.rampStartedAt) ?? null,
    updatedAt: new Date(profile.updatedAt),
  };
}

async function syncUserContactFields(
  userId: string,
  fields: UserContactFields,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      phone: fields.phone,
      dailyReminderTime: fields.dailyReminderTime,
      city: fields.city,
      state: fields.state,
    },
  });
}

export async function loadMemberProfileFromDb(
  userId: string,
): Promise<MemberProfile | null> {
  const row = await prisma.memberProfile.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          phone: true,
          dailyReminderTime: true,
          city: true,
          state: true,
        },
      },
    },
  });
  if (!row) return null;
  return rowToMemberProfile(row, row.user);
}

export async function loadMemberProfilesFromDb(): Promise<Record<string, MemberProfile>> {
  const rows = await prisma.memberProfile.findMany({
    include: {
      user: {
        select: {
          phone: true,
          dailyReminderTime: true,
          city: true,
          state: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const store: Record<string, MemberProfile> = {};
  for (const row of rows) {
    store[row.userId] = rowToMemberProfile(row, row.user);
  }
  return store;
}

export async function upsertMemberProfileToDb(profile: MemberProfile): Promise<MemberProfile> {
  const data = profileToDbFields(profile);
  const row = await prisma.memberProfile.upsert({
    where: { userId: profile.userId },
    create: data,
    update: data,
    include: {
      user: {
        select: {
          phone: true,
          dailyReminderTime: true,
          city: true,
          state: true,
        },
      },
    },
  });

  await syncUserContactFields(profile.userId, {
    phone: profile.phone,
    dailyReminderTime: profile.dailyReminderTime,
    city: profile.city,
    state: profile.state,
  });

  return rowToMemberProfile(row, {
    phone: profile.phone,
    dailyReminderTime: profile.dailyReminderTime,
    city: profile.city,
    state: profile.state,
  });
}

export async function updateMemberProfileInDb(
  userId: string,
  patch: MemberProfilePatch,
): Promise<MemberProfile> {
  const current = await loadMemberProfileFromDb(userId);
  if (!current) throw new Error("Profile not found");

  const next: MemberProfile = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  return upsertMemberProfileToDb(next);
}

export async function removeMemberProfilesFromDb(userIds: string[]): Promise<number> {
  if (userIds.length === 0) return 0;
  const result = await prisma.memberProfile.deleteMany({
    where: { userId: { in: userIds } },
  });
  return result.count;
}

export async function probeMemberProfilesDb(): Promise<{ ok: boolean; message: string | null }> {
  try {
    await prisma.memberProfile.count();
    return { ok: true, message: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Member profiles DB probe failed";
    return { ok: false, message };
  }
}