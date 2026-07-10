import "./import-env";
import path from "node:path";

import { hydrateJsonStore } from "../src/lib/demo-json-blob";
import { createPgPool } from "../src/lib/pg-connection";
import { normalizeAccountEmail } from "../src/lib/account-email";
import type { MemberProfile } from "../src/lib/member-profiles-types";
import { normalizeSignupPlan } from "../src/lib/signup-plans";
import type { Role } from "../src/generated/prisma/client";

type StoredMemberAccount = {
  userId: string;
  role: string;
  name: string;
  phone?: string | null;
  passwordHash?: string | null;
  hidden?: boolean;
  createdAt: string;
};

type RegisteredAccountsStore = Record<string, StoredMemberAccount>;

const AUTH_BLOB = "demo/registered-accounts.json";
const AUTH_DEV = path.join(process.cwd(), "prisma", "registered-accounts.dev.json");
const PROFILES_BLOB = "demo/member-profiles.json";
const PROFILES_DEV = path.join(process.cwd(), "prisma", "member-profiles.dev.json");
const OAUTH_BLOB = "demo/oauth-identities.json";
const OAUTH_DEV = path.join(process.cwd(), "prisma", "oauth-identities.dev.json");
const RESET_BLOB = "demo/password-reset-tokens.json";
const RESET_DEV = path.join(process.cwd(), "prisma", "password-reset-tokens.dev.json");
const SMS_BLOB = "demo/sms-workouts.json";
const SMS_DEV = path.join(process.cwd(), "prisma", "sms-workouts.dev.json");
const CHAT_BLOB = "demo/coach-chat.json";
const CHAT_DEV = path.join(process.cwd(), "prisma", "coach-chat.dev.json");
const LIVE_BLOB = "demo/live-workout-sessions.json";
const LIVE_DEV = path.join(process.cwd(), "prisma", "live-workout-sessions.dev.json");
const SETTINGS_BLOB = "demo/coach-settings.json";
const SETTINGS_DEV = path.join(process.cwd(), "prisma", "coach-settings.dev.json");
const PREFS_BLOB = "demo/member-coach-prefs.json";
const PREFS_DEV = path.join(process.cwd(), "prisma", "member-coach-prefs.dev.json");
const PARTNERS_BLOB = "demo/commission-partners.json";
const PARTNERS_DEV = path.join(process.cwd(), "prisma", "commission-partners.dev.json");
const LEDGER_BLOB = "demo/commission-ledger.json";
const LEDGER_DEV = path.join(process.cwd(), "prisma", "commission-ledger.dev.json");
const REFERRAL_BLOB = "demo/referral-codes.json";
const REFERRAL_DEV = path.join(process.cwd(), "prisma", "referral-codes.dev.json");
const WEBHOOK_BLOB = "demo/stripe-webhook-events.json";
const WEBHOOK_DEV = path.join(process.cwd(), "prisma", "stripe-webhook-events.dev.json");
const WAITLIST_BLOB = "demo/waitlist.json";
const WAITLIST_DEV = path.join(process.cwd(), "prisma", "waitlist.dev.json");
const OFFERS_BLOB = "demo/custom-training-offers.json";
const OFFERS_DEV = path.join(process.cwd(), "prisma", "custom-training-offers.dev.json");

const OAUTH_PROVIDERS = new Set(["google", "apple", "facebook"]);

const STORE_ALIASES: Record<string, string> = {
  auth: "auth",
  "registered-accounts": "auth",
  profiles: "profiles",
  "member-profiles": "profiles",
  oauth: "oauth",
  "oauth-identities": "oauth",
  reset: "reset-tokens",
  "reset-tokens": "reset-tokens",
  "password-reset-tokens": "reset-tokens",
  sms: "sms",
  "sms-workouts": "sms",
  chat: "coach-chat",
  "coach-chat": "coach-chat",
  live: "live-sessions",
  "live-sessions": "live-sessions",
  "live-workout-sessions": "live-sessions",
  settings: "coach-settings",
  "coach-settings": "coach-settings",
  prefs: "coach-prefs",
  "coach-prefs": "coach-prefs",
  "member-coach-prefs": "coach-prefs",
  partners: "partners",
  "commission-partners": "partners",
  ledger: "ledger",
  "commission-ledger": "ledger",
  referrals: "referrals",
  "referral-codes": "referrals",
  webhooks: "webhooks",
  "stripe-webhook-events": "webhooks",
  waitlist: "waitlist",
  offers: "offers",
  "custom-training-offers": "offers",
};

const ALL_STORES = [
  "auth",
  "profiles",
  "oauth",
  "reset-tokens",
  "sms",
  "coach-chat",
  "live-sessions",
  "coach-settings",
  "coach-prefs",
  "partners",
  "ledger",
  "referrals",
  "webhooks",
  "waitlist",
  "offers",
] as const;

function parseArgs(argv: string[]) {
  const storesArg = argv.find((a) => a.startsWith("--stores="))?.split("=")[1] ?? "auth";
  const rawStores = storesArg
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const stores =
    rawStores.length === 1 && rawStores[0] === "all"
      ? [...ALL_STORES]
      : rawStores.map((s) => STORE_ALIASES[s] ?? s);
  return {
    dryRun: argv.includes("--dry-run"),
    verbose: argv.includes("--verbose"),
    stores,
  };
}

function resolveConnectionString(): string {
  const direct = process.env.POSTGRES_URL_NON_POOLING ?? process.env.DIRECT_URL ?? "";
  const pooled =
    process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? "";
  return (
    direct ||
    (pooled && !pooled.includes("dummy") ? pooled : "")
  );
}

async function loadAuthSnapshot(): Promise<RegisteredAccountsStore> {
  let memory: RegisteredAccountsStore | null = null;
  const hydrated = await hydrateJsonStore({
    blobPath: AUTH_BLOB,
    localPath: AUTH_DEV,
    memory,
    setMemory: (v) => {
      memory = (v as RegisteredAccountsStore) || {};
    },
    fallback: () => ({}),
    preferFresh: true,
  });
  return (hydrated as RegisteredAccountsStore) || {};
}

async function importAuth(
  prisma: import("../src/generated/prisma/client").PrismaClient,
  opts: { dryRun: boolean; verbose: boolean },
) {
  const store = await loadAuthSnapshot();
  const entries = Object.entries(store);
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const [rawEmail, account] of entries) {
    const email = normalizeAccountEmail(rawEmail);
    if (!email) {
      skipped += 1;
      continue;
    }
    if (account.hidden) {
      skipped += 1;
      if (opts.verbose) console.log(`[auth] skip hidden ${email}`);
      continue;
    }

    const data = {
      id: account.userId,
      email,
      name: account.name || "Member",
      phone: account.phone ?? null,
      role: account.role as Role,
      passwordHash: account.passwordHash ?? null,
      hidden: Boolean(account.hidden),
      hiddenAt: account.hidden ? new Date(account.createdAt) : null,
      registeredAt: new Date(account.createdAt),
    };

    if (opts.dryRun) {
      if (opts.verbose) console.log(`[auth] dry-run upsert ${email} → ${data.id}`);
      imported += 1;
      continue;
    }

    try {
      await prisma.user.upsert({
        where: { email },
        create: data,
        update: {
          name: data.name,
          phone: data.phone,
          role: data.role,
          passwordHash: data.passwordHash,
          hidden: data.hidden,
          hiddenAt: data.hiddenAt,
          registeredAt: data.registeredAt,
        },
      });
      imported += 1;
      if (opts.verbose) console.log(`[auth] upserted ${email}`);
    } catch (error) {
      skipped += 1;
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${email}: ${message}`);
      console.error(`[auth] failed ${email}:`, message);
    }
  }

  const summary = {
    store: "auth",
    blobCount: entries.length,
    imported,
    skipped,
    orphanUserIds: [] as string[],
    errors,
  };
  console.log(JSON.stringify(summary, null, 2));
}

type ProfileStore = Record<string, unknown>;

function parseOptionalDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeApprovalStatus(raw: unknown): MemberProfile["approvalStatus"] {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (value === "pending" || value === "approved" || value === "rejected") return value;
  return "approved";
}

function normalizePaymentStatus(
  raw: unknown,
  plan: MemberProfile["plan"],
): MemberProfile["paymentStatus"] {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (value === "none" || value === "pending" || value === "paid" || value === "failed") {
    return value;
  }
  return plan === "explorer" ? "none" : "pending";
}

function normalizeImportedProfile(raw: unknown, userId: string): MemberProfile | null {
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
    paymentMethod:
      data.paymentMethod === "stripe" ||
      data.paymentMethod === "venmo" ||
      data.paymentMethod === "manual" ||
      data.paymentMethod === "other"
        ? data.paymentMethod
        : null,
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

async function loadProfilesSnapshot(): Promise<ProfileStore> {
  let memory: ProfileStore | null = null;
  const hydrated = await hydrateJsonStore({
    blobPath: PROFILES_BLOB,
    localPath: PROFILES_DEV,
    memory,
    setMemory: (v) => {
      memory = (v as ProfileStore) || {};
    },
    fallback: () => ({}),
    preferFresh: true,
  });
  return (hydrated as ProfileStore) || {};
}

async function importProfiles(
  prisma: import("../src/generated/prisma/client").PrismaClient,
  opts: { dryRun: boolean; verbose: boolean },
) {
  const store = await loadProfilesSnapshot();
  const entries = Object.entries(store);
  let imported = 0;
  let skipped = 0;
  const orphanUserIds: string[] = [];
  const errors: string[] = [];

  for (const [userId, raw] of entries) {
    const profile = normalizeImportedProfile(raw, userId);
    if (!profile) {
      skipped += 1;
      continue;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      orphanUserIds.push(userId);
      skipped += 1;
      if (opts.verbose) console.log(`[profiles] skip orphan userId=${userId}`);
      continue;
    }

    const data = {
      userId: profile.userId,
      email: profile.email,
      plan: profile.plan,
      weightLbs: profile.weightLbs,
      notes: profile.notes,
      onboardingComplete: profile.onboardingComplete,
      completedAt: parseOptionalDate(profile.completedAt),
      approvalStatus: profile.approvalStatus,
      approvedAt: parseOptionalDate(profile.approvedAt),
      paymentStatus: profile.paymentStatus,
      paidAt: parseOptionalDate(profile.paidAt),
      paymentMethod: profile.paymentMethod,
      paymentNote: profile.paymentNote,
      stripeCustomerId: profile.stripeCustomerId,
      stripeSubscriptionId: profile.stripeSubscriptionId,
      stripeCheckoutSessionId: profile.stripeCheckoutSessionId,
      referralCode: profile.referralCode,
      referredByUserId: profile.referredByUserId,
      intensiveSessionsTotal: profile.intensiveSessionsTotal,
      intensiveSessionsRemaining: profile.intensiveSessionsRemaining,
      intensiveWindowDays: profile.intensiveWindowDays,
      intensiveStartsAt: parseOptionalDate(profile.intensiveStartsAt),
      intensiveExpiresAt: parseOptionalDate(profile.intensiveExpiresAt),
      customTrainingOfferId: profile.customTrainingOfferId,
      welcomeSignupEmailSentAt: parseOptionalDate(profile.welcomeSignupEmailSentAt),
      welcomeCompleteEmailSentAt: parseOptionalDate(profile.welcomeCompleteEmailSentAt),
      welcomeSmsSentAt: parseOptionalDate(profile.welcomeSmsSentAt),
      coachIntakeCompleteAt: parseOptionalDate(profile.coachIntakeCompleteAt),
      coachIntakeCompletedBy: profile.coachIntakeCompletedBy,
      introBookedAt: parseOptionalDate(profile.introBookedAt),
      coachMeetingRequestedAt: parseOptionalDate(profile.coachMeetingRequestedAt),
      coachMeetingRequestedBy: profile.coachMeetingRequestedBy,
      coachMeetingRequestNote: profile.coachMeetingRequestNote,
      rampStartedAt: parseOptionalDate(profile.rampStartedAt),
      updatedAt: new Date(profile.updatedAt),
    };

    if (opts.dryRun) {
      if (opts.verbose) console.log(`[profiles] dry-run upsert ${userId}`);
      imported += 1;
      continue;
    }

    try {
      await prisma.memberProfile.upsert({
        where: { userId },
        create: data,
        update: data,
      });
      await prisma.user.update({
        where: { id: userId },
        data: {
          phone: profile.phone,
          dailyReminderTime: profile.dailyReminderTime,
          city: profile.city,
          state: profile.state,
        },
      });
      imported += 1;
      if (opts.verbose) console.log(`[profiles] upserted ${userId}`);
    } catch (error) {
      skipped += 1;
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${userId}: ${message}`);
      console.error(`[profiles] failed ${userId}:`, message);
    }
  }

  const summary = {
    store: "profiles",
    blobCount: entries.length,
    imported,
    skipped,
    orphanUserIds,
    errors,
  };
  console.log(JSON.stringify(summary, null, 2));
}

type OAuthIdentityStore = Record<
  string,
  {
    provider: string;
    providerUserId: string;
    userId: string;
    email: string;
    linkedAt: string;
  }
>;

type ResetTokenStore = Record<
  string,
  {
    email: string;
    expiresAt: string;
    createdAt: string;
  }
>;

async function loadOAuthSnapshot(): Promise<OAuthIdentityStore> {
  let memory: OAuthIdentityStore | null = null;
  const hydrated = await hydrateJsonStore({
    blobPath: OAUTH_BLOB,
    localPath: OAUTH_DEV,
    memory,
    setMemory: (v) => {
      memory = (v as OAuthIdentityStore) || {};
    },
    fallback: () => ({}),
    preferFresh: true,
  });
  return (hydrated as OAuthIdentityStore) || {};
}

async function importOAuth(
  prisma: import("../src/generated/prisma/client").PrismaClient,
  opts: { dryRun: boolean; verbose: boolean },
) {
  const store = await loadOAuthSnapshot();
  const entries = Object.entries(store);
  let imported = 0;
  let skipped = 0;
  const orphanUserIds: string[] = [];
  const errors: string[] = [];

  for (const [, identity] of entries) {
    const provider = identity.provider?.trim().toLowerCase();
    const providerUserId = identity.providerUserId?.trim();
    const userId = identity.userId?.trim();
    const email = normalizeAccountEmail(identity.email);

    if (!provider || !OAUTH_PROVIDERS.has(provider) || !providerUserId || !userId || !email) {
      skipped += 1;
      continue;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      orphanUserIds.push(userId);
      skipped += 1;
      if (opts.verbose) console.log(`[oauth] skip orphan userId=${userId}`);
      continue;
    }

    const linkedAt = parseOptionalDate(identity.linkedAt) ?? new Date();

    if (opts.dryRun) {
      if (opts.verbose) console.log(`[oauth] dry-run upsert ${provider}:${providerUserId}`);
      imported += 1;
      continue;
    }

    try {
      await prisma.oAuthIdentity.upsert({
        where: {
          provider_providerUserId: { provider, providerUserId },
        },
        create: {
          provider,
          providerUserId,
          userId,
          email,
          linkedAt,
        },
        update: {
          userId,
          email,
          linkedAt,
        },
      });
      imported += 1;
      if (opts.verbose) console.log(`[oauth] upserted ${provider}:${providerUserId}`);
    } catch (error) {
      skipped += 1;
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${provider}:${providerUserId}: ${message}`);
      console.error(`[oauth] failed ${provider}:${providerUserId}:`, message);
    }
  }

  const summary = {
    store: "oauth",
    blobCount: entries.length,
    imported,
    skipped,
    orphanUserIds,
    errors,
  };
  console.log(JSON.stringify(summary, null, 2));
}

async function loadResetSnapshot(): Promise<ResetTokenStore> {
  let memory: ResetTokenStore | null = null;
  const hydrated = await hydrateJsonStore({
    blobPath: RESET_BLOB,
    localPath: RESET_DEV,
    memory,
    setMemory: (v) => {
      memory = (v as ResetTokenStore) || {};
    },
    fallback: () => ({}),
    preferFresh: true,
  });
  return (hydrated as ResetTokenStore) || {};
}

async function importResetTokens(
  prisma: import("../src/generated/prisma/client").PrismaClient,
  opts: { dryRun: boolean; verbose: boolean },
) {
  const store = await loadResetSnapshot();
  const entries = Object.entries(store);
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const [tokenHash, entry] of entries) {
    const email = normalizeAccountEmail(entry.email);
    const expiresAt = parseOptionalDate(entry.expiresAt);
    const createdAt = parseOptionalDate(entry.createdAt) ?? new Date();

    if (!tokenHash || !email || !expiresAt) {
      skipped += 1;
      continue;
    }

    if (expiresAt.getTime() < Date.now()) {
      skipped += 1;
      if (opts.verbose) console.log(`[reset-tokens] skip expired ${email}`);
      continue;
    }

    if (opts.dryRun) {
      if (opts.verbose) console.log(`[reset-tokens] dry-run upsert ${email}`);
      imported += 1;
      continue;
    }

    try {
      await prisma.passwordResetToken.upsert({
        where: { tokenHash },
        create: {
          tokenHash,
          email,
          expiresAt,
          createdAt,
        },
        update: {
          email,
          expiresAt,
          createdAt,
        },
      });
      imported += 1;
      if (opts.verbose) console.log(`[reset-tokens] upserted ${email}`);
    } catch (error) {
      skipped += 1;
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${tokenHash.slice(0, 8)}…: ${message}`);
      console.error(`[reset-tokens] failed ${email}:`, message);
    }
  }

  const summary = {
    store: "reset-tokens",
    blobCount: entries.length,
    imported,
    skipped,
    orphanUserIds: [] as string[],
    errors,
  };
  console.log(JSON.stringify(summary, null, 2));
}

type SmsWorkoutStore = {
  workouts: Array<{
    id: string;
    name: string;
    description?: string;
    source?: string;
    createdAt: string;
    restTimerEnabled?: boolean;
    restTimerSeconds?: number;
    exportText?: string | null;
    certifiedAt?: string | null;
  }>;
  workoutExercises: Array<{
    id: string;
    workoutId: string;
    exerciseId: string;
    blockName?: string | null;
    sortOrder: number;
    sets: number | null;
    reps: string | null;
    notes: string | null;
    setScheme: string | null;
    weightTier: string | null;
  }>;
};

async function loadSmsSnapshot(): Promise<SmsWorkoutStore> {
  let memory: SmsWorkoutStore | null = null;
  const hydrated = await hydrateJsonStore({
    blobPath: SMS_BLOB,
    localPath: SMS_DEV,
    memory,
    setMemory: (v) => {
      memory = (v as SmsWorkoutStore) || { workouts: [], workoutExercises: [] };
    },
    fallback: () => ({ workouts: [], workoutExercises: [] }),
    preferFresh: true,
  });
  return (hydrated as SmsWorkoutStore) || { workouts: [], workoutExercises: [] };
}

async function importSmsWorkouts(
  prisma: import("../src/generated/prisma/client").PrismaClient,
  opts: { dryRun: boolean; verbose: boolean },
) {
  const store = await loadSmsSnapshot();
  const workouts = store.workouts || [];
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  const missingExerciseIds: string[] = [];

  for (const workout of workouts) {
    if (!workout.id || !workout.name) {
      skipped += 1;
      continue;
    }

    const exercises = (store.workoutExercises || [])
      .filter((we) => we.workoutId === workout.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    for (const exercise of exercises) {
      const exists = await prisma.exercise.findUnique({
        where: { id: exercise.exerciseId },
        select: { id: true },
      });
      if (!exists) {
        missingExerciseIds.push(exercise.exerciseId);
      }
    }

    if (opts.dryRun) {
      if (opts.verbose) console.log(`[sms] dry-run upsert ${workout.id}`);
      imported += 1;
      continue;
    }

    try {
      await prisma.workout.upsert({
        where: { id: workout.id },
        create: {
          id: workout.id,
          name: workout.name,
          description: workout.description ?? null,
          source: "sms",
          restTimerEnabled: Boolean(workout.restTimerEnabled),
          restTimerSeconds: workout.restTimerSeconds ?? null,
          exportText: workout.exportText ?? null,
          certifiedAt: parseOptionalDate(workout.certifiedAt),
          createdAt: parseOptionalDate(workout.createdAt) ?? new Date(),
        },
        update: {
          name: workout.name,
          description: workout.description ?? null,
          source: "sms",
          restTimerEnabled: Boolean(workout.restTimerEnabled),
          restTimerSeconds: workout.restTimerSeconds ?? null,
          exportText: workout.exportText ?? null,
          certifiedAt: parseOptionalDate(workout.certifiedAt),
        },
      });

      await prisma.workoutExercise.deleteMany({ where: { workoutId: workout.id } });
      for (const exercise of exercises) {
        const exists = await prisma.exercise.findUnique({
          where: { id: exercise.exerciseId },
          select: { id: true },
        });
        if (!exists) {
          skipped += 1;
          if (opts.verbose) {
            console.log(`[sms] skip missing exercise ${exercise.exerciseId} for ${workout.id}`);
          }
          continue;
        }

        await prisma.workoutExercise.create({
          data: {
            id: exercise.id,
            workoutId: exercise.workoutId,
            exerciseId: exercise.exerciseId,
            blockName: exercise.blockName ?? null,
            sortOrder: exercise.sortOrder,
            sets: exercise.sets,
            reps: exercise.reps,
            notes: exercise.notes,
            setScheme: exercise.setScheme,
            weightTier: exercise.weightTier,
          },
        });
      }

      imported += 1;
      if (opts.verbose) console.log(`[sms] upserted ${workout.id}`);
    } catch (error) {
      skipped += 1;
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${workout.id}: ${message}`);
      console.error(`[sms] failed ${workout.id}:`, message);
    }
  }

  const summary = {
    store: "sms",
    blobCount: workouts.length,
    imported,
    skipped,
    orphanUserIds: [] as string[],
    missingExerciseIds: [...new Set(missingExerciseIds)],
    errors,
  };
  console.log(JSON.stringify(summary, null, 2));
}

type CoachChatStore = {
  threads: Array<{
    id: string;
    kind: string;
    memberId?: string;
    programSlug?: string;
    title: string;
    createdAt: string;
    updatedAt: string;
  }>;
  messages: Array<{
    id: string;
    threadId: string;
    authorRole: string;
    authorId: string;
    authorName: string;
    kind: string;
    body?: string;
    mediaUrl?: string;
    youtubeId?: string;
    videoDurationSec?: number;
    sessionDate?: string;
    todaySessionId?: string;
    workoutId?: string;
    workoutTitle?: string;
    smsLogId?: string;
    alertSent?: boolean;
    createdAt: string;
    readByUserIds: string[];
    reactions?: unknown;
  }>;
};

async function loadCoachChatSnapshot(): Promise<CoachChatStore> {
  let memory: CoachChatStore | null = null;
  const hydrated = await hydrateJsonStore({
    blobPath: CHAT_BLOB,
    localPath: CHAT_DEV,
    memory,
    setMemory: (v) => {
      memory = (v as CoachChatStore) || { threads: [], messages: [] };
    },
    fallback: () => ({ threads: [], messages: [] }),
    preferFresh: true,
  });
  return (hydrated as CoachChatStore) || { threads: [], messages: [] };
}

async function importCoachChat(
  prisma: import("../src/generated/prisma/client").PrismaClient,
  opts: { dryRun: boolean; verbose: boolean },
) {
  const store = await loadCoachChatSnapshot();
  const threads = store.threads || [];
  const messages = store.messages || [];
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  const threadIds = new Set(threads.map((t) => t.id));

  for (const thread of threads) {
    if (!thread.id || !thread.title || !thread.kind) {
      skipped += 1;
      continue;
    }

    const data = {
      id: thread.id,
      kind: thread.kind,
      memberId: thread.memberId ?? null,
      programSlug: thread.programSlug ?? null,
      title: thread.title,
      createdAt: parseOptionalDate(thread.createdAt) ?? new Date(),
      updatedAt: parseOptionalDate(thread.updatedAt) ?? new Date(),
    };

    if (opts.dryRun) {
      if (opts.verbose) console.log(`[coach-chat] dry-run thread ${thread.id}`);
      imported += 1;
      continue;
    }

    try {
      await prisma.coachChatThread.upsert({
        where: { id: thread.id },
        create: data,
        update: {
          kind: data.kind,
          memberId: data.memberId,
          programSlug: data.programSlug,
          title: data.title,
          updatedAt: data.updatedAt,
        },
      });
      imported += 1;
      if (opts.verbose) console.log(`[coach-chat] upserted thread ${thread.id}`);
    } catch (error) {
      skipped += 1;
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`thread ${thread.id}: ${message}`);
      console.error(`[coach-chat] failed thread ${thread.id}:`, message);
    }
  }

  let messagesImported = 0;
  for (const message of messages) {
    if (!message.id || !message.threadId || !threadIds.has(message.threadId)) {
      skipped += 1;
      if (opts.verbose && message.threadId) {
        console.log(`[coach-chat] skip orphan message ${message.id}`);
      }
      continue;
    }

    const data = {
      id: message.id,
      threadId: message.threadId,
      authorRole: message.authorRole,
      authorId: message.authorId,
      authorName: message.authorName,
      kind: message.kind,
      body: message.body ?? null,
      mediaUrl: message.mediaUrl ?? null,
      youtubeId: message.youtubeId ?? null,
      videoDurationSec: message.videoDurationSec ?? null,
      sessionDate: message.sessionDate ?? null,
      todaySessionId: message.todaySessionId ?? null,
      workoutId: message.workoutId ?? null,
      workoutTitle: message.workoutTitle ?? null,
      smsLogId: message.smsLogId ?? null,
      alertSent: Boolean(message.alertSent),
      readByUserIds: message.readByUserIds ?? [],
      reactions:
        message.reactions === null || message.reactions === undefined
          ? undefined
          : (message.reactions as import("../src/generated/prisma/client").Prisma.InputJsonValue),
      createdAt: parseOptionalDate(message.createdAt) ?? new Date(),
    };

    if (opts.dryRun) {
      if (opts.verbose) console.log(`[coach-chat] dry-run message ${message.id}`);
      messagesImported += 1;
      continue;
    }

    try {
      await prisma.coachChatMessage.upsert({
        where: { id: message.id },
        create: data,
        update: {
          threadId: data.threadId,
          authorRole: data.authorRole,
          authorId: data.authorId,
          authorName: data.authorName,
          kind: data.kind,
          body: data.body,
          mediaUrl: data.mediaUrl,
          youtubeId: data.youtubeId,
          videoDurationSec: data.videoDurationSec,
          sessionDate: data.sessionDate,
          todaySessionId: data.todaySessionId,
          workoutId: data.workoutId,
          workoutTitle: data.workoutTitle,
          smsLogId: data.smsLogId,
          alertSent: data.alertSent,
          readByUserIds: data.readByUserIds,
          reactions: data.reactions,
          createdAt: data.createdAt,
        },
      });
      messagesImported += 1;
      if (opts.verbose) console.log(`[coach-chat] upserted message ${message.id}`);
    } catch (error) {
      skipped += 1;
      const errMessage = error instanceof Error ? error.message : String(error);
      errors.push(`message ${message.id}: ${errMessage}`);
      console.error(`[coach-chat] failed message ${message.id}:`, errMessage);
    }
  }

  const summary = {
    store: "coach-chat",
    blobCount: threads.length + messages.length,
    imported: imported + messagesImported,
    skipped,
    orphanUserIds: [] as string[],
    threadCount: threads.length,
    messageCount: messages.length,
    errors,
  };
  console.log(JSON.stringify(summary, null, 2));
}

type LiveSessionStore = {
  sessions: Record<
    string,
    {
      userId: string;
      workoutId: string;
      sessionDate: string;
      completedSets?: Record<string, number[]>;
      finishedExercises?: string[];
      weights?: Record<string, string>;
      activeId?: string;
      updatedBy?: string;
      revision?: number;
      updatedAt?: string;
    }
  >;
};

async function loadLiveSessionsSnapshot(): Promise<LiveSessionStore> {
  let memory: LiveSessionStore | null = null;
  const hydrated = await hydrateJsonStore({
    blobPath: LIVE_BLOB,
    localPath: LIVE_DEV,
    memory,
    setMemory: (v) => {
      memory = (v as LiveSessionStore) || { sessions: {} };
    },
    fallback: () => ({ sessions: {} }),
    preferFresh: true,
  });
  return (hydrated as LiveSessionStore) || { sessions: {} };
}

async function importLiveSessions(
  prisma: import("../src/generated/prisma/client").PrismaClient,
  opts: { dryRun: boolean; verbose: boolean },
) {
  const store = await loadLiveSessionsSnapshot();
  const sessions = Object.values(store.sessions || {});
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const session of sessions) {
    if (!session.userId || !session.workoutId || !session.sessionDate) {
      skipped += 1;
      continue;
    }

    const data = {
      userId: session.userId,
      workoutId: session.workoutId,
      sessionDate: session.sessionDate,
      completedSets: session.completedSets ?? {},
      finishedExercises: session.finishedExercises ?? [],
      weights: session.weights ?? {},
      activeId: session.activeId ?? null,
      updatedBy: session.updatedBy === "member" ? "member" : "coach",
      revision: typeof session.revision === "number" ? session.revision : 0,
      updatedAt: parseOptionalDate(session.updatedAt) ?? new Date(),
    };

    if (opts.dryRun) {
      if (opts.verbose) {
        console.log(`[live-sessions] dry-run ${session.userId}:${session.workoutId}:${session.sessionDate}`);
      }
      imported += 1;
      continue;
    }

    try {
      await prisma.liveWorkoutSession.upsert({
        where: {
          userId_workoutId_sessionDate: {
            userId: data.userId,
            workoutId: data.workoutId,
            sessionDate: data.sessionDate,
          },
        },
        create: data,
        update: {
          completedSets: data.completedSets,
          finishedExercises: data.finishedExercises,
          weights: data.weights,
          activeId: data.activeId,
          updatedBy: data.updatedBy,
          revision: data.revision,
          updatedAt: data.updatedAt,
        },
      });
      imported += 1;
      if (opts.verbose) {
        console.log(`[live-sessions] upserted ${session.userId}:${session.workoutId}:${session.sessionDate}`);
      }
    } catch (error) {
      skipped += 1;
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${session.userId}:${session.workoutId}: ${message}`);
      console.error(`[live-sessions] failed ${session.userId}:`, message);
    }
  }

  const summary = {
    store: "live-sessions",
    blobCount: sessions.length,
    imported,
    skipped,
    orphanUserIds: [] as string[],
    errors,
  };
  console.log(JSON.stringify(summary, null, 2));
}

async function loadCoachSettingsSnapshot(): Promise<unknown> {
  let memory: unknown = null;
  const hydrated = await hydrateJsonStore({
    blobPath: SETTINGS_BLOB,
    localPath: SETTINGS_DEV,
    memory,
    setMemory: (v) => {
      memory = v;
    },
    fallback: () => null,
    preferFresh: true,
  });
  return hydrated;
}

async function importCoachSettings(
  prisma: import("../src/generated/prisma/client").PrismaClient,
  opts: { dryRun: boolean; verbose: boolean },
) {
  const raw = await loadCoachSettingsSnapshot();
  if (!raw || typeof raw !== "object") {
    console.log(
      JSON.stringify(
        {
          store: "coach-settings",
          blobCount: 0,
          imported: 0,
          skipped: 1,
          orphanUserIds: [] as string[],
          errors: ["empty or invalid coach-settings blob"],
        },
        null,
        2,
      ),
    );
    return;
  }

  const data = raw as Record<string, unknown>;
  const row = {
    id: "default",
    coachPhone: typeof data.coachPhone === "string" ? data.coachPhone : null,
    coachEmail: typeof data.coachEmail === "string" ? data.coachEmail : null,
    messagingEnabled: data.messagingEnabled === false ? false : true,
    autoPromptIntroBooking: data.autoPromptIntroBooking === true,
    autoPromptFollowUpBooking: data.autoPromptFollowUpBooking === true,
    commissionPayoutMode: data.commissionPayoutMode === "weekly" ? "weekly" : "on_demand",
    commissionPayoutWeekday:
      typeof data.commissionPayoutWeekday === "number"
        ? Math.max(0, Math.min(6, Math.floor(data.commissionPayoutWeekday)))
        : 5,
    alertPrefs: data.alertPrefs ?? {},
    warmupBlocks: data.warmupBlocks ?? [],
    rampTemplate: data.rampTemplate ?? [],
    gamificationPoints: data.gamificationPoints ?? {},
    updatedAt: parseOptionalDate(data.updatedAt) ?? new Date(),
  };

  if (opts.dryRun) {
    if (opts.verbose) console.log("[coach-settings] dry-run upsert default");
    console.log(
      JSON.stringify(
        {
          store: "coach-settings",
          blobCount: 1,
          imported: 1,
          skipped: 0,
          orphanUserIds: [] as string[],
          errors: [] as string[],
        },
        null,
        2,
      ),
    );
    return;
  }

  try {
    await prisma.coachSettings.upsert({
      where: { id: "default" },
      create: row,
      update: {
        coachPhone: row.coachPhone,
        coachEmail: row.coachEmail,
        messagingEnabled: row.messagingEnabled,
        autoPromptIntroBooking: row.autoPromptIntroBooking,
        autoPromptFollowUpBooking: row.autoPromptFollowUpBooking,
        commissionPayoutMode: row.commissionPayoutMode,
        commissionPayoutWeekday: row.commissionPayoutWeekday,
        alertPrefs: row.alertPrefs as import("../src/generated/prisma/client").Prisma.InputJsonValue,
        warmupBlocks: row.warmupBlocks as import("../src/generated/prisma/client").Prisma.InputJsonValue,
        rampTemplate: row.rampTemplate as import("../src/generated/prisma/client").Prisma.InputJsonValue,
        gamificationPoints:
          row.gamificationPoints as import("../src/generated/prisma/client").Prisma.InputJsonValue,
        updatedAt: row.updatedAt,
      },
    });
    console.log(
      JSON.stringify(
        {
          store: "coach-settings",
          blobCount: 1,
          imported: 1,
          skipped: 0,
          orphanUserIds: [] as string[],
          errors: [] as string[],
        },
        null,
        2,
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(
      JSON.stringify(
        {
          store: "coach-settings",
          blobCount: 1,
          imported: 0,
          skipped: 1,
          orphanUserIds: [] as string[],
          errors: [message],
        },
        null,
        2,
      ),
    );
    console.error("[coach-settings] failed:", message);
  }
}

type MemberCoachPrefsStore = Record<
  string,
  {
    userId?: string;
    coachingMode?: string;
    alertOverrides?: unknown;
    updatedAt?: string;
  }
>;

async function loadMemberCoachPrefsSnapshot(): Promise<MemberCoachPrefsStore> {
  let memory: MemberCoachPrefsStore | null = null;
  const hydrated = await hydrateJsonStore({
    blobPath: PREFS_BLOB,
    localPath: PREFS_DEV,
    memory,
    setMemory: (v) => {
      memory = (v as MemberCoachPrefsStore) || {};
    },
    fallback: () => ({}),
    preferFresh: true,
  });
  return (hydrated as MemberCoachPrefsStore) || {};
}

async function importMemberCoachPrefs(
  prisma: import("../src/generated/prisma/client").PrismaClient,
  opts: { dryRun: boolean; verbose: boolean },
) {
  const store = await loadMemberCoachPrefsSnapshot();
  const entries = Object.entries(store);
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  const orphanUserIds: string[] = [];

  for (const [userId, raw] of entries) {
    if (!userId) {
      skipped += 1;
      continue;
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) {
      skipped += 1;
      orphanUserIds.push(userId);
      if (opts.verbose) console.log(`[coach-prefs] skip orphan user ${userId}`);
      continue;
    }

    const coachingMode =
      raw?.coachingMode === "live" || raw?.coachingMode === "async" ? raw.coachingMode : null;
    const data = {
      userId,
      coachingMode,
      alertOverrides: raw?.alertOverrides ?? {},
      updatedAt: parseOptionalDate(raw?.updatedAt) ?? new Date(),
    };

    if (opts.dryRun) {
      if (opts.verbose) console.log(`[coach-prefs] dry-run ${userId}`);
      imported += 1;
      continue;
    }

    try {
      await prisma.memberCoachPrefs.upsert({
        where: { userId },
        create: data,
        update: {
          coachingMode: data.coachingMode,
          alertOverrides: data.alertOverrides as import("../src/generated/prisma/client").Prisma.InputJsonValue,
          updatedAt: data.updatedAt,
        },
      });
      imported += 1;
      if (opts.verbose) console.log(`[coach-prefs] upserted ${userId}`);
    } catch (error) {
      skipped += 1;
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${userId}: ${message}`);
      console.error(`[coach-prefs] failed ${userId}:`, message);
    }
  }

  const summary = {
    store: "coach-prefs",
    blobCount: entries.length,
    imported,
    skipped,
    orphanUserIds: [...new Set(orphanUserIds)],
    errors,
  };
  console.log(JSON.stringify(summary, null, 2));
}

type PartnersStore = {
  partners: Array<{
    id: string;
    name: string;
    email: string;
    stripeAccountId?: string | null;
    sharePercent?: number;
    enabled?: boolean;
    notes?: string | null;
    createdAt?: string;
    updatedAt?: string;
  }>;
};

async function loadPartnersSnapshot(): Promise<PartnersStore> {
  let memory: PartnersStore | null = null;
  const hydrated = await hydrateJsonStore({
    blobPath: PARTNERS_BLOB,
    localPath: PARTNERS_DEV,
    memory,
    setMemory: (v) => {
      memory = (v as PartnersStore) || { partners: [] };
    },
    fallback: () => ({ partners: [] }),
    preferFresh: true,
  });
  return (hydrated as PartnersStore) || { partners: [] };
}

async function importCommissionPartners(
  prisma: import("../src/generated/prisma/client").PrismaClient,
  opts: { dryRun: boolean; verbose: boolean },
) {
  const store = await loadPartnersSnapshot();
  const partners = store.partners || [];
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const partner of partners) {
    if (!partner.id || !partner.name || !partner.email) {
      skipped += 1;
      continue;
    }

    const data = {
      id: partner.id,
      name: partner.name.trim(),
      email: partner.email.trim().toLowerCase(),
      stripeAccountId: partner.stripeAccountId?.trim() || null,
      sharePercent:
        typeof partner.sharePercent === "number" && Number.isFinite(partner.sharePercent)
          ? Math.max(0, Math.min(100, partner.sharePercent))
          : 0,
      enabled: partner.enabled !== false,
      notes: typeof partner.notes === "string" ? partner.notes : null,
      createdAt: parseOptionalDate(partner.createdAt) ?? new Date(),
      updatedAt: parseOptionalDate(partner.updatedAt) ?? new Date(),
    };

    if (opts.dryRun) {
      if (opts.verbose) console.log(`[partners] dry-run ${partner.id}`);
      imported += 1;
      continue;
    }

    try {
      await prisma.commissionPartner.upsert({
        where: { id: partner.id },
        create: data,
        update: {
          name: data.name,
          email: data.email,
          stripeAccountId: data.stripeAccountId,
          sharePercent: data.sharePercent,
          enabled: data.enabled,
          notes: data.notes,
          updatedAt: data.updatedAt,
        },
      });
      imported += 1;
      if (opts.verbose) console.log(`[partners] upserted ${partner.id}`);
    } catch (error) {
      skipped += 1;
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${partner.id}: ${message}`);
      console.error(`[partners] failed ${partner.id}:`, message);
    }
  }

  const summary = {
    store: "partners",
    blobCount: partners.length,
    imported,
    skipped,
    orphanUserIds: [] as string[],
    errors,
  };
  console.log(JSON.stringify(summary, null, 2));
}

type LedgerStore = {
  payouts: Array<{
    id: string;
    period: string;
    mrrCents?: number;
    tier1BaseCents?: number;
    tier1CommissionCents?: number;
    tier2BaseCents?: number;
    tier2CommissionCents?: number;
    totalCommissionCents?: number;
    transferId?: string | null;
    partnerLines?: Array<{
      partnerId: string;
      partnerName: string;
      sharePercent?: number;
      amountCents?: number;
      transferId?: string | null;
      status?: string;
      error?: string | null;
    }>;
    status?: string;
    createdAt?: string;
    paidAt?: string | null;
    error?: string | null;
  }>;
};

async function loadLedgerSnapshot(): Promise<LedgerStore> {
  let memory: LedgerStore | null = null;
  const hydrated = await hydrateJsonStore({
    blobPath: LEDGER_BLOB,
    localPath: LEDGER_DEV,
    memory,
    setMemory: (v) => {
      memory = (v as LedgerStore) || { payouts: [] };
    },
    fallback: () => ({ payouts: [] }),
    preferFresh: true,
  });
  return (hydrated as LedgerStore) || { payouts: [] };
}

async function importCommissionLedger(
  prisma: import("../src/generated/prisma/client").PrismaClient,
  opts: { dryRun: boolean; verbose: boolean },
) {
  const store = await loadLedgerSnapshot();
  const payouts = store.payouts || [];
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  const skippedLines: string[] = [];

  const partnerIds = new Set(
    (await prisma.commissionPartner.findMany({ select: { id: true } })).map((p) => p.id),
  );
  const fallbackPartnerId = partnerIds.values().next().value as string | undefined;

  for (const payout of payouts) {
    if (!payout.id || !payout.period) {
      skipped += 1;
      continue;
    }

    const data = {
      id: payout.id,
      period: payout.period,
      mrrCents: payout.mrrCents ?? 0,
      tier1BaseCents: payout.tier1BaseCents ?? 0,
      tier1CommissionCents: payout.tier1CommissionCents ?? 0,
      tier2BaseCents: payout.tier2BaseCents ?? 0,
      tier2CommissionCents: payout.tier2CommissionCents ?? 0,
      totalCommissionCents: payout.totalCommissionCents ?? 0,
      transferId: payout.transferId ?? null,
      status: payout.status ?? "pending",
      error: payout.error ?? null,
      createdAt: parseOptionalDate(payout.createdAt) ?? new Date(),
      paidAt: parseOptionalDate(payout.paidAt),
    };

    const lines = payout.partnerLines ?? [];
    const lineData: Array<{
      payoutId: string;
      partnerId: string;
      partnerName: string;
      sharePercent: number;
      amountCents: number;
      transferId: string | null;
      status: string;
      error: string | null;
    }> = [];

    for (const line of lines) {
      if (!line.partnerId || !line.partnerName) continue;
      let partnerId = line.partnerId;
      if (!partnerIds.has(partnerId)) {
        if (partnerId === "legacy" && fallbackPartnerId) {
          partnerId = fallbackPartnerId;
        } else {
          skippedLines.push(`${payout.period}:${line.partnerId}`);
          if (opts.verbose) {
            console.log(`[ledger] skip line missing partner ${line.partnerId} for ${payout.period}`);
          }
          continue;
        }
      }
      lineData.push({
        payoutId: payout.id,
        partnerId,
        partnerName: line.partnerName,
        sharePercent: line.sharePercent ?? 0,
        amountCents: line.amountCents ?? 0,
        transferId: line.transferId ?? null,
        status: line.status ?? "pending",
        error: line.error ?? null,
      });
    }

    if (opts.dryRun) {
      if (opts.verbose) console.log(`[ledger] dry-run ${payout.period}`);
      imported += 1;
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.commissionPayout.upsert({
          where: { period: payout.period },
          create: data,
          update: {
            mrrCents: data.mrrCents,
            tier1BaseCents: data.tier1BaseCents,
            tier1CommissionCents: data.tier1CommissionCents,
            tier2BaseCents: data.tier2BaseCents,
            tier2CommissionCents: data.tier2CommissionCents,
            totalCommissionCents: data.totalCommissionCents,
            transferId: data.transferId,
            status: data.status,
            error: data.error,
            paidAt: data.paidAt,
          },
        });
        await tx.commissionPayoutLine.deleteMany({ where: { payoutId: payout.id } });
        if (lineData.length > 0) {
          await tx.commissionPayoutLine.createMany({ data: lineData });
        }
      });
      imported += 1;
      if (opts.verbose) console.log(`[ledger] upserted ${payout.period}`);
    } catch (error) {
      skipped += 1;
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${payout.period}: ${message}`);
      console.error(`[ledger] failed ${payout.period}:`, message);
    }
  }

  const summary = {
    store: "ledger",
    blobCount: payouts.length,
    imported,
    skipped,
    orphanUserIds: [] as string[],
    skippedPartnerLines: [...new Set(skippedLines)],
    errors,
  };
  console.log(JSON.stringify(summary, null, 2));
}

type ReferralStore = {
  codes: Array<{
    id: string;
    code: string;
    label?: string;
    stripePromotionCodeId?: string | null;
    stripeCouponId?: string | null;
    ownerUserId?: string | null;
    enabled?: boolean;
    notes?: string | null;
    createdAt?: string;
    updatedAt?: string;
  }>;
};

async function loadReferralsSnapshot(): Promise<ReferralStore> {
  let memory: ReferralStore | null = null;
  const hydrated = await hydrateJsonStore({
    blobPath: REFERRAL_BLOB,
    localPath: REFERRAL_DEV,
    memory,
    setMemory: (v) => {
      memory = (v as ReferralStore) || { codes: [] };
    },
    fallback: () => ({ codes: [] }),
    preferFresh: true,
  });
  return (hydrated as ReferralStore) || { codes: [] };
}

async function importReferralCodes(
  prisma: import("../src/generated/prisma/client").PrismaClient,
  opts: { dryRun: boolean; verbose: boolean },
) {
  const store = await loadReferralsSnapshot();
  const codes = store.codes || [];
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  const orphanUserIds: string[] = [];

  for (const code of codes) {
    if (!code.id || !code.code) {
      skipped += 1;
      continue;
    }

    const normalizedCode = code.code.trim().toUpperCase().replace(/\s+/g, "");
    if (!normalizedCode) {
      skipped += 1;
      continue;
    }

    if (code.ownerUserId) {
      const user = await prisma.user.findUnique({
        where: { id: code.ownerUserId },
        select: { id: true },
      });
      if (!user) {
        skipped += 1;
        orphanUserIds.push(code.ownerUserId);
        if (opts.verbose) console.log(`[referrals] skip orphan owner ${code.ownerUserId}`);
        continue;
      }
    }

    const data = {
      id: code.id,
      code: normalizedCode,
      label: code.label?.trim() || normalizedCode,
      stripePromotionCodeId: code.stripePromotionCodeId?.trim() || null,
      stripeCouponId: code.stripeCouponId?.trim() || null,
      ownerUserId: code.ownerUserId?.trim() || null,
      enabled: code.enabled !== false,
      notes: typeof code.notes === "string" ? code.notes : null,
      createdAt: parseOptionalDate(code.createdAt) ?? new Date(),
      updatedAt: parseOptionalDate(code.updatedAt) ?? new Date(),
    };

    if (opts.dryRun) {
      if (opts.verbose) console.log(`[referrals] dry-run ${normalizedCode}`);
      imported += 1;
      continue;
    }

    try {
      await prisma.referralCode.upsert({
        where: { id: code.id },
        create: data,
        update: {
          code: data.code,
          label: data.label,
          stripePromotionCodeId: data.stripePromotionCodeId,
          stripeCouponId: data.stripeCouponId,
          ownerUserId: data.ownerUserId,
          enabled: data.enabled,
          notes: data.notes,
          updatedAt: data.updatedAt,
        },
      });
      imported += 1;
      if (opts.verbose) console.log(`[referrals] upserted ${normalizedCode}`);
    } catch (error) {
      skipped += 1;
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${normalizedCode}: ${message}`);
      console.error(`[referrals] failed ${normalizedCode}:`, message);
    }
  }

  const summary = {
    store: "referrals",
    blobCount: codes.length,
    imported,
    skipped,
    orphanUserIds: [...new Set(orphanUserIds)],
    errors,
  };
  console.log(JSON.stringify(summary, null, 2));
}

type WebhookEventStore = Record<string, { processedAt: string; type: string }>;

async function loadWebhooksSnapshot(): Promise<WebhookEventStore> {
  let memory: WebhookEventStore | null = null;
  const hydrated = await hydrateJsonStore({
    blobPath: WEBHOOK_BLOB,
    localPath: WEBHOOK_DEV,
    memory,
    setMemory: (v) => {
      memory = (v as WebhookEventStore) || {};
    },
    fallback: () => ({}),
    preferFresh: true,
  });
  return (hydrated as WebhookEventStore) || {};
}

async function importStripeWebhooks(
  prisma: import("../src/generated/prisma/client").PrismaClient,
  opts: { dryRun: boolean; verbose: boolean },
) {
  const store = await loadWebhooksSnapshot();
  const entries = Object.entries(store);
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const [eventId, event] of entries) {
    if (!eventId || !event?.type) {
      skipped += 1;
      continue;
    }

    const data = {
      eventId,
      type: event.type,
      processedAt: parseOptionalDate(event.processedAt) ?? new Date(),
    };

    if (opts.dryRun) {
      if (opts.verbose) console.log(`[webhooks] dry-run ${eventId}`);
      imported += 1;
      continue;
    }

    try {
      await prisma.stripeWebhookEvent.upsert({
        where: { eventId },
        create: data,
        update: {
          type: data.type,
          processedAt: data.processedAt,
        },
      });
      imported += 1;
      if (opts.verbose) console.log(`[webhooks] upserted ${eventId}`);
    } catch (error) {
      skipped += 1;
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${eventId}: ${message}`);
      console.error(`[webhooks] failed ${eventId}:`, message);
    }
  }

  const summary = {
    store: "webhooks",
    blobCount: entries.length,
    imported,
    skipped,
    orphanUserIds: [] as string[],
    errors,
  };
  console.log(JSON.stringify(summary, null, 2));
}

type WaitlistStore = {
  entries: Array<{
    id: string;
    email: string;
    name: string;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    plan?: string | null;
    source?: string | null;
    createdAt?: string;
  }>;
};

async function loadWaitlistSnapshot(): Promise<WaitlistStore> {
  let memory: WaitlistStore | null = null;
  const hydrated = await hydrateJsonStore({
    blobPath: WAITLIST_BLOB,
    localPath: WAITLIST_DEV,
    memory,
    setMemory: (v) => {
      memory = (v as WaitlistStore) || { entries: [] };
    },
    fallback: () => ({ entries: [] }),
    preferFresh: true,
  });
  return (hydrated as WaitlistStore) || { entries: [] };
}

async function importWaitlist(
  prisma: import("../src/generated/prisma/client").PrismaClient,
  opts: { dryRun: boolean; verbose: boolean },
) {
  const store = await loadWaitlistSnapshot();
  const entries = store.entries || [];
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const entry of entries) {
    if (!entry.id || !entry.email || !entry.name) {
      skipped += 1;
      continue;
    }

    const email = entry.email.trim().toLowerCase();
    const data = {
      id: entry.id,
      email,
      name: entry.name,
      firstName: entry.firstName ?? null,
      lastName: entry.lastName ?? null,
      phone: entry.phone ?? null,
      plan: entry.plan ?? null,
      source: entry.source ?? null,
      createdAt: parseOptionalDate(entry.createdAt) ?? new Date(),
    };

    if (opts.dryRun) {
      if (opts.verbose) console.log(`[waitlist] dry-run ${email}`);
      imported += 1;
      continue;
    }

    try {
      await prisma.waitlistEntry.upsert({
        where: { email },
        create: data,
        update: {
          name: data.name,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          plan: data.plan,
          source: data.source,
        },
      });
      imported += 1;
      if (opts.verbose) console.log(`[waitlist] upserted ${email}`);
    } catch (error) {
      skipped += 1;
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${email}: ${message}`);
      console.error(`[waitlist] failed ${email}:`, message);
    }
  }

  const summary = {
    store: "waitlist",
    blobCount: entries.length,
    imported,
    skipped,
    orphanUserIds: [] as string[],
    errors,
  };
  console.log(JSON.stringify(summary, null, 2));
}

type OffersStore = {
  offers: Array<{
    id: string;
    label: string;
    memberEmail?: string | null;
    memberUserId?: string | null;
    priceCents?: number;
    currency?: string;
    parameters?: unknown;
    status?: string;
    stripeCheckoutSessionId?: string | null;
    createdByEmail?: string | null;
    notes?: string | null;
    createdAt?: string;
    updatedAt?: string;
  }>;
};

async function loadOffersSnapshot(): Promise<OffersStore> {
  let memory: OffersStore | null = null;
  const hydrated = await hydrateJsonStore({
    blobPath: OFFERS_BLOB,
    localPath: OFFERS_DEV,
    memory,
    setMemory: (v) => {
      memory = (v as OffersStore) || { offers: [] };
    },
    fallback: () => ({ offers: [] }),
    preferFresh: true,
  });
  return (hydrated as OffersStore) || { offers: [] };
}

async function importCustomTrainingOffers(
  prisma: import("../src/generated/prisma/client").PrismaClient,
  opts: { dryRun: boolean; verbose: boolean },
) {
  const store = await loadOffersSnapshot();
  const offers = store.offers || [];
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  const orphanUserIds: string[] = [];

  for (const offer of offers) {
    if (!offer.id || !offer.label) {
      skipped += 1;
      continue;
    }

    if (offer.memberUserId) {
      const user = await prisma.user.findUnique({
        where: { id: offer.memberUserId },
        select: { id: true },
      });
      if (!user) {
        skipped += 1;
        orphanUserIds.push(offer.memberUserId);
        if (opts.verbose) console.log(`[offers] skip orphan member ${offer.memberUserId}`);
        continue;
      }
    }

    const data = {
      id: offer.id,
      label: offer.label.trim(),
      memberEmail: offer.memberEmail?.trim().toLowerCase() || null,
      memberUserId: offer.memberUserId?.trim() || null,
      priceCents: Math.max(0, Math.round(Number(offer.priceCents) || 0)),
      currency: offer.currency?.trim() || "usd",
      parameters: offer.parameters ?? {},
      status:
        offer.status === "sent" || offer.status === "paid" || offer.status === "canceled"
          ? offer.status
          : "draft",
      stripeCheckoutSessionId: offer.stripeCheckoutSessionId ?? null,
      createdByEmail: offer.createdByEmail ?? null,
      notes: typeof offer.notes === "string" ? offer.notes : null,
      createdAt: parseOptionalDate(offer.createdAt) ?? new Date(),
      updatedAt: parseOptionalDate(offer.updatedAt) ?? new Date(),
    };

    if (opts.dryRun) {
      if (opts.verbose) console.log(`[offers] dry-run ${offer.id}`);
      imported += 1;
      continue;
    }

    try {
      await prisma.customTrainingOffer.upsert({
        where: { id: offer.id },
        create: {
          ...data,
          parameters: data.parameters as import("../src/generated/prisma/client").Prisma.InputJsonValue,
        },
        update: {
          label: data.label,
          memberEmail: data.memberEmail,
          memberUserId: data.memberUserId,
          priceCents: data.priceCents,
          currency: data.currency,
          parameters: data.parameters as import("../src/generated/prisma/client").Prisma.InputJsonValue,
          status: data.status,
          stripeCheckoutSessionId: data.stripeCheckoutSessionId,
          createdByEmail: data.createdByEmail,
          notes: data.notes,
          updatedAt: data.updatedAt,
        },
      });
      imported += 1;
      if (opts.verbose) console.log(`[offers] upserted ${offer.id}`);
    } catch (error) {
      skipped += 1;
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${offer.id}: ${message}`);
      console.error(`[offers] failed ${offer.id}:`, message);
    }
  }

  const summary = {
    store: "offers",
    blobCount: offers.length,
    imported,
    skipped,
    orphanUserIds: [...new Set(orphanUserIds)],
    errors,
  };
  console.log(JSON.stringify(summary, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const connectionString = resolveConnectionString();
  if (!connectionString) {
    console.error("[import-blob-stores] No Postgres URL — pull Vercel production env.");
    process.exit(1);
  }

  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("../src/generated/prisma/client");
  const adapter = new PrismaPg(createPgPool(connectionString));
  const prisma = new PrismaClient({ adapter });

  try {
    for (const store of args.stores) {
      if (store === "auth") {
        await importAuth(prisma, { dryRun: args.dryRun, verbose: args.verbose });
      } else if (store === "profiles") {
        await importProfiles(prisma, { dryRun: args.dryRun, verbose: args.verbose });
      } else if (store === "oauth") {
        await importOAuth(prisma, { dryRun: args.dryRun, verbose: args.verbose });
      } else if (store === "reset-tokens") {
        await importResetTokens(prisma, { dryRun: args.dryRun, verbose: args.verbose });
      } else if (store === "sms") {
        await importSmsWorkouts(prisma, { dryRun: args.dryRun, verbose: args.verbose });
      } else if (store === "coach-chat") {
        await importCoachChat(prisma, { dryRun: args.dryRun, verbose: args.verbose });
      } else if (store === "live-sessions") {
        await importLiveSessions(prisma, { dryRun: args.dryRun, verbose: args.verbose });
      } else if (store === "coach-settings") {
        await importCoachSettings(prisma, { dryRun: args.dryRun, verbose: args.verbose });
      } else if (store === "coach-prefs") {
        await importMemberCoachPrefs(prisma, { dryRun: args.dryRun, verbose: args.verbose });
      } else if (store === "partners") {
        await importCommissionPartners(prisma, { dryRun: args.dryRun, verbose: args.verbose });
      } else if (store === "ledger") {
        await importCommissionLedger(prisma, { dryRun: args.dryRun, verbose: args.verbose });
      } else if (store === "referrals") {
        await importReferralCodes(prisma, { dryRun: args.dryRun, verbose: args.verbose });
      } else if (store === "webhooks") {
        await importStripeWebhooks(prisma, { dryRun: args.dryRun, verbose: args.verbose });
      } else if (store === "waitlist") {
        await importWaitlist(prisma, { dryRun: args.dryRun, verbose: args.verbose });
      } else if (store === "offers") {
        await importCustomTrainingOffers(prisma, { dryRun: args.dryRun, verbose: args.verbose });
      } else {
        console.warn(`[import-blob-stores] Store not implemented yet: ${store}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[import-blob-stores] fatal:", error);
  process.exit(1);
});