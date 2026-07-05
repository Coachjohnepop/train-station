import "server-only";

import { isDatabaseConfigured } from "@/lib/database-config";
import { resolveDemoUser } from "@/lib/demo-user-directory";
import type { EnrollmentsMap, TrainingLocation } from "@/lib/data/types";
import {
  clampPhaseWeek,
  macroPhasesForProgramSlug,
  normalizeTrainingLocation,
} from "@/lib/program-macro-cycle";
import { clampEnrollmentPosition } from "@/lib/member-enrollment-day";
import { prisma } from "@/lib/prisma";

/** Map demo roster ids (demo-user-*) to Prisma User.id in database mode. */
export async function resolveStorageUserId(userId: string): Promise<string> {
  if (!isDatabaseConfigured()) return userId;

  const direct = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (direct) return direct.id;

  const demo = resolveDemoUser(userId);
  if (demo?.email) {
    const byEmail = await prisma.user.findUnique({
      where: { email: demo.email },
      select: { id: true },
    });
    if (byEmail) return byEmail.id;
  }

  return userId;
}

export async function getEnrollmentsMapForUser(userId: string): Promise<EnrollmentsMap> {
  const storageUserId = await resolveStorageUserId(userId);
  const rows = await prisma.programEnrollment.findMany({
    where: { userId: storageUserId },
    include: { program: { select: { slug: true } } },
  });
  const map: EnrollmentsMap = {};
  for (const row of rows) {
    map[row.program.slug] = {
      currentWeek: row.currentWeek,
      currentDay: row.currentDay,
      currentPhase: row.currentPhase,
      trainingLocation: normalizeTrainingLocation(row.trainingLocation),
    };
  }
  return map;
}

export async function enrollUserInProgramDb(slug: string, userId: string) {
  const storageUserId = await resolveStorageUserId(userId);
  const program = await prisma.program.findUnique({ where: { slug } });
  if (!program) throw new Error("Program not found");

  const existing = await prisma.programEnrollment.findFirst({
    where: { userId: storageUserId, programId: program.id },
  });
  if (existing) return existing;

  return prisma.programEnrollment.create({
    data: {
      userId: storageUserId,
      programId: program.id,
      currentWeek: 1,
      currentDay: 1,
      currentPhase: 1,
      trainingLocation: "gym",
    },
  });
}

export async function unenrollUserFromProgramDb(slug: string, userId: string) {
  const storageUserId = await resolveStorageUserId(userId);
  const program = await prisma.program.findUnique({ where: { slug } });
  if (!program) return;
  await prisma.programEnrollment.deleteMany({
    where: { userId: storageUserId, programId: program.id },
  });
}

export async function setUserProgramPositionDb(
  userId: string,
  slug: string,
  currentWeek: number,
  currentDay: number,
  opts?: { currentPhase?: number; trainingLocation?: TrainingLocation },
) {
  const storageUserId = await resolveStorageUserId(userId);
  const program = await prisma.program.findUnique({ where: { slug } });
  if (!program) throw new Error("Program not found");

  const phases = macroPhasesForProgramSlug(slug);
  const phaseClamped = phases.length
    ? clampPhaseWeek(opts?.currentPhase ?? 1, currentWeek, phases)
    : { phaseIndex: opts?.currentPhase ?? 1, weekInPhase: currentWeek };
  const { weekNumber, dayNumber } = clampEnrollmentPosition(
    phaseClamped.weekInPhase,
    currentDay,
    phases.length ? phases[phaseClamped.phaseIndex - 1]?.maxWeeks ?? program.durationWeeks : program.durationWeeks,
  );
  const trainingLocation = normalizeTrainingLocation(opts?.trainingLocation);

  let enrollment = await prisma.programEnrollment.findFirst({
    where: { userId: storageUserId, programId: program.id },
  });
  if (!enrollment) {
    enrollment = await prisma.programEnrollment.create({
      data: {
        userId: storageUserId,
        programId: program.id,
        currentWeek: weekNumber,
        currentDay: dayNumber,
        currentPhase: phaseClamped.phaseIndex,
        trainingLocation,
      },
    });
  } else {
    enrollment = await prisma.programEnrollment.update({
      where: { id: enrollment.id },
      data: {
        currentWeek: weekNumber,
        currentDay: dayNumber,
        currentPhase: phaseClamped.phaseIndex,
        trainingLocation,
      },
    });
  }
  return enrollment;
}

export async function setUserTrainingLocationDb(
  userId: string,
  slug: string,
  trainingLocation: TrainingLocation,
) {
  const storageUserId = await resolveStorageUserId(userId);
  const program = await prisma.program.findUnique({ where: { slug } });
  if (!program) throw new Error("Program not found");

  const enrollment = await prisma.programEnrollment.findFirst({
    where: { userId: storageUserId, programId: program.id },
  });
  if (!enrollment) throw new Error("Not enrolled in program");

  return prisma.programEnrollment.update({
    where: { id: enrollment.id },
    data: { trainingLocation: normalizeTrainingLocation(trainingLocation) },
  });
}