import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.vercel.prod" });
dotenv.config({ path: ".env.vercel.production", override: true });

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

const STORE_ALIASES: Record<string, string> = {
  auth: "auth",
  "registered-accounts": "auth",
  profiles: "profiles",
  "member-profiles": "profiles",
};

function parseArgs(argv: string[]) {
  const storesArg = argv.find((a) => a.startsWith("--stores="))?.split("=")[1] ?? "auth";
  return {
    dryRun: argv.includes("--dry-run"),
    verbose: argv.includes("--verbose"),
    stores: storesArg
      .split(",")
      .map((s) => STORE_ALIASES[s.trim()] ?? s.trim())
      .filter(Boolean),
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