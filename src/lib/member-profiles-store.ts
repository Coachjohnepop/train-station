import "server-only";

import path from "path";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";
import { normalizeSignupPlan, type SignupPlan } from "@/lib/signup-plans";

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
    updatedAt: new Date().toISOString(),
  };
}

function normalizeProfile(raw: unknown, userId: string): MemberProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<MemberProfile>;
  if (!data.email) return null;
  return {
    userId,
    email: data.email,
    plan: normalizeSignupPlan(data.plan),
    phone: data.phone ?? null,
    dailyReminderTime: data.dailyReminderTime ?? null,
    weightLbs: data.weightLbs ?? null,
    notes: data.notes ?? null,
    city: data.city ?? null,
    state: data.state ?? null,
    onboardingComplete: Boolean(data.onboardingComplete),
    completedAt: data.completedAt ?? null,
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