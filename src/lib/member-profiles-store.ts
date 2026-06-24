import "server-only";

import path from "path";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";
import {
  defaultApprovalStatus,
  defaultPaymentStatus,
  normalizeApprovalStatus,
  normalizePaymentStatus,
  type ApprovalStatus,
  type PaymentStatus,
} from "@/lib/member-gates";
import { normalizeSignupPlan, type SignupPlan } from "@/lib/signup-plans";

export type PaymentMethod = "stripe" | "venmo" | "manual" | "other";

export type MemberProfile = {
  userId: string;
  email: string;
  plan: SignupPlan;
  phone: string | null;
  dailyReminderTime: string | null;
  weightLbs: string | null;
  notes: string | null;
  city: string | null;
  state: string | null;
  onboardingComplete: boolean;
  completedAt: string | null;
  approvalStatus: ApprovalStatus;
  approvedAt: string | null;
  paymentStatus: PaymentStatus;
  paidAt: string | null;
  paymentMethod: PaymentMethod | null;
  paymentNote: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeCheckoutSessionId: string | null;
  referralCode: string | null;
  referredByUserId: string | null;
  welcomeSignupEmailSentAt: string | null;
  welcomeCompleteEmailSentAt: string | null;
  welcomeSmsSentAt: string | null;
  updatedAt: string;
};

type ProfileStore = Record<string, MemberProfile>;

const BLOB_PATH = "demo/member-profiles.json";
const DEV_FILE = path.join(process.cwd(), "prisma", "member-profiles.dev.json");

let memoryStore: ProfileStore | null = null;

function emptyProfile(userId: string, email: string, plan: SignupPlan): MemberProfile {
  return {
    userId,
    email,
    plan,
    phone: null,
    dailyReminderTime: null,
    weightLbs: null,
    notes: null,
    city: null,
    state: null,
    onboardingComplete: false,
    completedAt: null,
    approvalStatus: defaultApprovalStatus(),
    approvedAt: null,
    paymentStatus: defaultPaymentStatus(plan),
    paidAt: null,
    paymentMethod: null,
    paymentNote: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripeCheckoutSessionId: null,
    referralCode: null,
    referredByUserId: null,
    welcomeSignupEmailSentAt: null,
    welcomeCompleteEmailSentAt: null,
    welcomeSmsSentAt: null,
    updatedAt: new Date().toISOString(),
  };
}

function normalizePaymentMethod(raw: unknown): PaymentMethod | null {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (v === "stripe" || v === "venmo" || v === "manual" || v === "other") return v;
  return null;
}

function normalizeProfile(raw: unknown, userId: string): MemberProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<MemberProfile>;
  if (!data.email) return null;
  const plan = normalizeSignupPlan(data.plan);
  return {
    userId,
    email: data.email,
    plan,
    phone: data.phone ?? null,
    dailyReminderTime: data.dailyReminderTime ?? null,
    weightLbs: data.weightLbs ?? null,
    notes: data.notes ?? null,
    city: data.city ?? null,
    state: data.state ?? null,
    onboardingComplete: Boolean(data.onboardingComplete),
    completedAt: data.completedAt ?? null,
    approvalStatus: normalizeApprovalStatus(data.approvalStatus),
    approvedAt: data.approvedAt ?? null,
    paymentStatus: normalizePaymentStatus(data.paymentStatus, plan),
    paidAt: data.paidAt ?? null,
    paymentMethod: normalizePaymentMethod(data.paymentMethod),
    paymentNote: typeof data.paymentNote === "string" ? data.paymentNote : null,
    stripeCustomerId: data.stripeCustomerId ?? null,
    stripeSubscriptionId: data.stripeSubscriptionId ?? null,
    stripeCheckoutSessionId: data.stripeCheckoutSessionId ?? null,
    referralCode:
      typeof data.referralCode === "string" && data.referralCode.trim()
        ? data.referralCode.trim().toUpperCase()
        : null,
    referredByUserId:
      typeof data.referredByUserId === "string" && data.referredByUserId.trim()
        ? data.referredByUserId.trim()
        : null,
    welcomeSignupEmailSentAt: data.welcomeSignupEmailSentAt ?? null,
    welcomeCompleteEmailSentAt: data.welcomeCompleteEmailSentAt ?? null,
    welcomeSmsSentAt: data.welcomeSmsSentAt ?? null,
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
}

async function getStore(): Promise<ProfileStore> {
  const hydrated = await hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory: (v) => {
      memoryStore = v as ProfileStore;
    },
    fallback: () => ({}),
  });
  memoryStore = hydrated as ProfileStore;
  return memoryStore;
}

export async function getMemberProfile(userId: string): Promise<MemberProfile | null> {
  const store = await getStore();
  const profile = store[userId];
  return profile ? normalizeProfile(profile, userId) : null;
}

export async function listMemberProfiles(): Promise<MemberProfile[]> {
  const store = await getStore();
  return Object.entries(store)
    .map(([userId, raw]) => normalizeProfile(raw, userId))
    .filter((p): p is MemberProfile => Boolean(p))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function ensureMemberProfile(input: {
  userId: string;
  email: string;
  plan: string;
  phone?: string | null;
}): Promise<MemberProfile> {
  const store = await getStore();
  const existing = store[input.userId];
  if (existing) {
    const normalized = normalizeProfile(existing, input.userId)!;
    store[input.userId] = normalized;
    return normalized;
  }

  const plan = normalizeSignupPlan(input.plan);
  const profile = emptyProfile(input.userId, input.email, plan);
  if (input.phone) profile.phone = input.phone;

  store[input.userId] = profile;
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory: (v) => {
      memoryStore = v as ProfileStore;
    },
  });

  return profile;
}

export async function removeMemberProfiles(userIds: string[]): Promise<number> {
  if (userIds.length === 0) return 0;
  const store = await getStore();
  let removed = 0;
  for (const id of userIds) {
    if (store[id]) {
      delete store[id];
      removed++;
    }
  }
  if (removed > 0) {
    await persistJsonStore({
      blobPath: BLOB_PATH,
      localPath: DEV_FILE,
      data: store,
      setMemory: (v) => {
        memoryStore = v as ProfileStore;
      },
    });
  }
  return removed;
}

export async function updateMemberProfile(
  userId: string,
  patch: Partial<
    Pick<
      MemberProfile,
      | "phone"
      | "dailyReminderTime"
      | "weightLbs"
      | "notes"
      | "city"
      | "state"
      | "onboardingComplete"
      | "completedAt"
      | "plan"
      | "welcomeSignupEmailSentAt"
      | "welcomeCompleteEmailSentAt"
      | "welcomeSmsSentAt"
      | "approvalStatus"
      | "approvedAt"
      | "paymentStatus"
      | "paidAt"
      | "paymentMethod"
      | "paymentNote"
      | "stripeCustomerId"
      | "stripeSubscriptionId"
      | "stripeCheckoutSessionId"
      | "referralCode"
      | "referredByUserId"
    >
  >,
): Promise<MemberProfile> {
  const store = await getStore();
  const current = store[userId];
  if (!current) throw new Error("Profile not found");

  const next: MemberProfile = {
    ...normalizeProfile(current, userId)!,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  store[userId] = next;
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory: (v) => {
      memoryStore = v as ProfileStore;
    },
  });

  return next;
}