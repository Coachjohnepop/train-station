import "server-only";

import path from "path";
import {
  blobReadFallbackEnabled,
  readMode,
  readsFromDatabase,
  writesToBlob,
  writesToDatabase,
} from "@/lib/blob-migration-config";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";
import { isDemoMode } from "@/lib/demo-enrollments";
import {
  defaultApprovalStatus,
  defaultPaymentStatus,
  normalizeApprovalStatus,
  normalizePaymentStatus,
} from "@/lib/member-gates";
import {
  loadMemberProfileFromDb,
  loadMemberProfilesFromDb,
  removeMemberProfilesFromDb,
  updateMemberProfileInDb,
  upsertMemberProfileToDb,
} from "@/lib/member-profiles-db";
import type {
  MemberProfile,
  MemberProfilePatch,
  PaymentMethod,
} from "@/lib/member-profiles-types";
import { normalizeSignupPlan, type SignupPlan } from "@/lib/signup-plans";

export type { MemberProfile, PaymentMethod };

type ProfileStore = Record<string, MemberProfile>;

const BLOB_PATH = "demo/member-profiles.json";
const DEV_FILE = path.join(process.cwd(), "prisma", "member-profiles.dev.json");
const STORE_KEY = "member-profiles" as const;

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
    staffGrantExpiresAt: null,
    staffGrantedAt: null,
    staffGrantedBy: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripeCheckoutSessionId: null,
    referralCode: null,
    referredByUserId: null,
    intensiveSessionsTotal: null,
    intensiveSessionsRemaining: null,
    intensiveWindowDays: null,
    intensiveStartsAt: null,
    intensiveExpiresAt: null,
    customTrainingOfferId: null,
    welcomeSignupEmailSentAt: null,
    welcomeCompleteEmailSentAt: null,
    welcomeSmsSentAt: null,
    coachIntakeCompleteAt: null,
    coachIntakeCompletedBy: null,
    introBookedAt: null,
    coachMeetingRequestedAt: null,
    coachMeetingRequestedBy: null,
    coachMeetingRequestNote: null,
    rampStartedAt: null,
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
    staffGrantExpiresAt:
      typeof data.staffGrantExpiresAt === "string" ? data.staffGrantExpiresAt : null,
    staffGrantedAt: typeof data.staffGrantedAt === "string" ? data.staffGrantedAt : null,
    staffGrantedBy:
      typeof data.staffGrantedBy === "string" && data.staffGrantedBy.trim()
        ? data.staffGrantedBy.trim()
        : null,
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
    intensiveSessionsTotal:
      typeof data.intensiveSessionsTotal === "number" ? data.intensiveSessionsTotal : null,
    intensiveSessionsRemaining:
      typeof data.intensiveSessionsRemaining === "number"
        ? data.intensiveSessionsRemaining
        : null,
    intensiveWindowDays:
      typeof data.intensiveWindowDays === "number" ? data.intensiveWindowDays : null,
    intensiveStartsAt: data.intensiveStartsAt ?? null,
    intensiveExpiresAt: data.intensiveExpiresAt ?? null,
    customTrainingOfferId:
      typeof data.customTrainingOfferId === "string" && data.customTrainingOfferId.trim()
        ? data.customTrainingOfferId.trim()
        : null,
    welcomeSignupEmailSentAt: data.welcomeSignupEmailSentAt ?? null,
    welcomeCompleteEmailSentAt: data.welcomeCompleteEmailSentAt ?? null,
    welcomeSmsSentAt: data.welcomeSmsSentAt ?? null,
    coachIntakeCompleteAt: data.coachIntakeCompleteAt ?? null,
    coachIntakeCompletedBy: data.coachIntakeCompletedBy ?? null,
    introBookedAt: data.introBookedAt ?? null,
    coachMeetingRequestedAt: data.coachMeetingRequestedAt ?? null,
    coachMeetingRequestedBy: data.coachMeetingRequestedBy ?? null,
    coachMeetingRequestNote:
      typeof data.coachMeetingRequestNote === "string" ? data.coachMeetingRequestNote : null,
    rampStartedAt: data.rampStartedAt ?? null,
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
}

async function loadProfileStoreFromBlob(
  opts?: { preferFresh?: boolean },
): Promise<ProfileStore> {
  const hydrated = await hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory: (v) => {
      memoryStore = v as ProfileStore;
    },
    fallback: () => ({}),
    preferFresh: opts?.preferFresh,
  });
  memoryStore = hydrated as ProfileStore;
  return memoryStore;
}

async function loadProfileStoreFromDb(): Promise<ProfileStore> {
  const store = await loadMemberProfilesFromDb();
  memoryStore = store;
  return store;
}

async function getStore(opts?: { preferFresh?: boolean }): Promise<ProfileStore> {
  if (isDemoMode() || readMode(STORE_KEY) === "blob") {
    return loadProfileStoreFromBlob(opts);
  }

  try {
    return await loadProfileStoreFromDb();
  } catch (error) {
    if (blobReadFallbackEnabled(STORE_KEY)) {
      console.warn("[migration] member-profiles DB read failed, falling back to blob", error);
      return loadProfileStoreFromBlob(opts);
    }
    throw error;
  }
}

async function persistProfileStore(store: ProfileStore): Promise<void> {
  if (writesToBlob(STORE_KEY)) {
    await persistJsonStore({
      blobPath: BLOB_PATH,
      localPath: DEV_FILE,
      data: store,
      setMemory: (v) => {
        memoryStore = v as ProfileStore;
      },
    });
  } else {
    memoryStore = store;
  }
}

async function mirrorProfileToDb(profile: MemberProfile): Promise<void> {
  if (!writesToDatabase(STORE_KEY) || isDemoMode()) return;
  await upsertMemberProfileToDb(profile);
}

/** New signups always persist MemberProfile to Postgres when DB is configured (PR-5). */
async function persistNewSignupProfileToDb(profile: MemberProfile): Promise<void> {
  if (isDemoMode()) return;
  await upsertMemberProfileToDb(profile);
}

export async function getMemberProfile(userId: string): Promise<MemberProfile | null> {
  if (!isDemoMode() && readsFromDatabase(STORE_KEY)) {
    try {
      const fromDb = await loadMemberProfileFromDb(userId);
      if (fromDb) return fromDb;
      if (!blobReadFallbackEnabled(STORE_KEY)) return null;
    } catch (error) {
      if (!blobReadFallbackEnabled(STORE_KEY)) throw error;
      console.warn("[migration] member-profiles DB read failed, falling back to blob", error);
    }
  }

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
  if (!isDemoMode() && readsFromDatabase(STORE_KEY)) {
    try {
      const existing = await loadMemberProfileFromDb(input.userId);
      if (existing) return existing;
      if (!blobReadFallbackEnabled(STORE_KEY)) {
        const plan = normalizeSignupPlan(input.plan);
        const profile = emptyProfile(input.userId, input.email, plan);
        if (input.phone) profile.phone = input.phone;
        await persistNewSignupProfileToDb(profile);
        if (writesToBlob(STORE_KEY)) {
          const store = await getStore();
          store[input.userId] = profile;
          await persistProfileStore(store);
        } else {
          memoryStore = { ...(memoryStore ?? {}), [input.userId]: profile };
        }
        return profile;
      }
    } catch (error) {
      if (!blobReadFallbackEnabled(STORE_KEY)) throw error;
      console.warn("[migration] member-profiles DB read failed, falling back to blob", error);
    }
  }

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

  if (isDemoMode() || writesToBlob(STORE_KEY)) {
    store[input.userId] = profile;
    await persistProfileStore(store);
  } else {
    memoryStore = { ...store, [input.userId]: profile };
  }
  await persistNewSignupProfileToDb(profile);

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
    await persistProfileStore(store);
    if (writesToDatabase(STORE_KEY) && !isDemoMode()) {
      await removeMemberProfilesFromDb(userIds);
    }
  }

  return removed;
}

export async function updateMemberProfile(
  userId: string,
  patch: MemberProfilePatch,
): Promise<MemberProfile> {
  if (!isDemoMode() && readsFromDatabase(STORE_KEY) && !writesToBlob(STORE_KEY)) {
    return updateMemberProfileInDb(userId, patch);
  }

  // Retry: blob CDN can briefly lag behind a profile we just wrote during signup.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const store =
      memoryStore?.[userId] != null && readMode(STORE_KEY) === "blob"
        ? memoryStore
        : await getStore();
    const current = store[userId];
    if (!current) {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
        continue;
      }
      throw new Error("Profile not found");
    }

    const next: MemberProfile = {
      ...normalizeProfile(current, userId)!,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    store[userId] = next;
    await persistProfileStore(store);
    await mirrorProfileToDb(next);

    return next;
  }

  throw new Error("Profile not found");
}