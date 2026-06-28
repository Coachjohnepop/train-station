#!/usr/bin/env node
/**
 * Persist a member as fully through the enrollment ramp on production blob storage.
 * Sets intro booked, coach intake complete, gamification ledger, and warmup progress.
 *
 * Usage:
 *   node scripts/complete-member-enrollment-prod.mjs john+ttt@bcxvoice.com
 */
import { blobOptions } from "./remove-member-email.mjs";
import { head, put } from "@vercel/blob";

const GAMIFICATION_POINTS = {
  onboarding_complete: 25,
  warmup_before_live: 50,
  intake_scheduled: 100,
  intake_complete: 75,
  workout_logged: 25,
};

const LABELS = {
  onboarding_complete: "Finished setup",
  warmup_before_live: "Warm-ups before live",
  intake_scheduled: "Booked intro call",
  intake_complete: "Intake complete",
  workout_logged: "Workout logged",
};

async function readJson(path) {
  const opts = blobOptions();
  const meta = await head(path, opts);
  const res = await fetch(`${meta.url}?_ts=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`read ${path}: ${res.status}`);
  return res.json();
}

async function writeJson(path, data) {
  await put(path, JSON.stringify(data, null, 2), {
    ...blobOptions(),
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

function sumPoints(events) {
  return events.reduce((sum, e) => sum + e.points, 0);
}

export async function completeMemberEnrollmentByEmail(rawEmail, opts = {}) {
  const email = rawEmail.trim().toLowerCase();
  const accounts = await readJson("demo/registered-accounts.json");
  const account = accounts[email];
  if (!account?.userId) {
    return { ok: false, reason: "account_not_found", email };
  }

  const userId = account.userId;
  const now = opts.now || new Date().toISOString();
  const base = new Date(now);
  const isoAt = (offsetMinutes) =>
    new Date(base.getTime() - offsetMinutes * 60_000).toISOString();
  const sessionDate = (opts.sessionDate || now).slice(0, 10);

  const profiles = await readJson("demo/member-profiles.json");
  const profile = profiles[userId];
  if (!profile) {
    return { ok: false, reason: "profile_not_found", email, userId };
  }

  const introBookedAt = profile.introBookedAt || isoAt(24 * 60 - 45);
  const coachIntakeCompleteAt = profile.coachIntakeCompleteAt || isoAt(24 * 60 - 15);
  const rampStartedAt = profile.rampStartedAt || profile.completedAt || isoAt(24 * 60);

  profiles[userId] = {
    ...profile,
    introBookedAt,
    coachIntakeCompleteAt,
    coachIntakeCompletedBy: profile.coachIntakeCompletedBy || "jeremy@thetrainstation.co",
    coachMeetingRequestedAt: null,
    coachMeetingRequestedBy: null,
    coachMeetingRequestNote: null,
    rampStartedAt,
    onboardingComplete: true,
    approvalStatus: profile.approvalStatus || "approved",
    paymentStatus: profile.paymentStatus || "paid",
    updatedAt: now,
  };
  await writeJson("demo/member-profiles.json", profiles);

  const events = [
    {
      id: "onboarding:complete",
      type: "onboarding_complete",
      points: GAMIFICATION_POINTS.onboarding_complete,
      label: LABELS.onboarding_complete,
      at: profile.completedAt || isoAt(24 * 60 - 5),
      programSlug: "adult",
    },
    {
      id: `warmup:${sessionDate}`,
      type: "warmup_before_live",
      points: GAMIFICATION_POINTS.warmup_before_live,
      label: LABELS.warmup_before_live,
      at: isoAt(24 * 60 - 40),
      programSlug: "adult",
    },
    {
      id: "intake:scheduled",
      type: "intake_scheduled",
      points: GAMIFICATION_POINTS.intake_scheduled,
      label: LABELS.intake_scheduled,
      at: introBookedAt,
      programSlug: "adult",
    },
    {
      id: "intake:complete",
      type: "intake_complete",
      points: GAMIFICATION_POINTS.intake_complete,
      label: LABELS.intake_complete,
      at: coachIntakeCompleteAt,
      programSlug: "adult",
    },
  ];

  if (opts.includeWorkoutLog !== false) {
    events.push({
      id: `workout:enrollment-demo:${sessionDate}`,
      type: "workout_logged",
      points: GAMIFICATION_POINTS.workout_logged,
      label: LABELS.workout_logged,
      at: isoAt(24 * 60 - 10),
      programSlug: "adult",
    });
  }

  const gamification = await readJson("demo/member-gamification.json");
  gamification[userId] = {
    userId,
    totalPoints: sumPoints(events),
    events,
    updatedAt: now,
  };
  await writeJson("demo/member-gamification.json", gamification);

  const warmupStore = await readJson("demo/member-warmup-progress.json");
  const warmupKey = `${userId}::${sessionDate}`;
  warmupStore[warmupKey] = {
    userId,
    sessionDate,
    completedSets: {
      "warmup-squat": [1, 2],
      "warmup-push": [1],
    },
    finishedExercises: ["warmup-squat", "warmup-push"],
    coachNotifiedAt: isoAt(24 * 60 - 40),
    updatedAt: now,
  };
  await writeJson("demo/member-warmup-progress.json", warmupStore);

  return {
    ok: true,
    email,
    userId,
    totalPoints: gamification[userId].totalPoints,
    introBookedAt,
    coachIntakeCompleteAt,
    sessionDate,
  };
}

const emailArg = process.argv[2]?.trim().toLowerCase();
if (!emailArg) {
  console.error("Usage: node scripts/complete-member-enrollment-prod.mjs <email>");
  process.exit(1);
}

try {
  const result = await completeMemberEnrollmentByEmail(emailArg);
  if (!result.ok) {
    console.error(result);
    process.exit(1);
  }
  console.log(`✓ Enrollment ramp complete for ${result.email} (${result.userId})`);
  console.log(`  Points: ${result.totalPoints}`);
  console.log(`  Intro booked: ${result.introBookedAt}`);
  console.log(`  Intake complete: ${result.coachIntakeCompleteAt}`);
  console.log(`  Warmup session: ${result.sessionDate}`);
} catch (e) {
  console.error(e);
  process.exit(1);
}