import "server-only";

import { isDatabaseConfigured } from "@/lib/database-config";
import {
  parseMeasurementPayload,
  serializeMeasurementRow,
  type MeasurementRecord,
  type MeasurementSource,
  type MeasurementValues,
} from "@/lib/body-measurements";

function prismaSelect() {
  return {
    id: true,
    userId: true,
    weightLbs: true,
    neckIn: true,
    shouldersIn: true,
    chestIn: true,
    waistIn: true,
    hipsIn: true,
    leftBicepIn: true,
    rightBicepIn: true,
    leftThighIn: true,
    rightThighIn: true,
    leftCalfIn: true,
    rightCalfIn: true,
    bodyFatPct: true,
    photoUrl: true,
    notes: true,
    measuredAt: true,
    source: true,
    recordedByUserId: true,
  } as const;
}

export type MeasurementSheetIdentity = {
  name: string | null;
  ageYears: number | null;
  gender: string | null;
  beforePhotoUrl: string | null;
};

function ageYearsFromBirthdate(birthdate: Date | null | undefined): number | null {
  if (!birthdate) return null;
  const now = new Date();
  let age = now.getFullYear() - birthdate.getFullYear();
  const m = now.getMonth() - birthdate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthdate.getDate())) age -= 1;
  if (age < 0 || age > 120) return null;
  return age;
}

export async function getMeasurementSheetIdentity(
  userId: string,
): Promise<MeasurementSheetIdentity> {
  if (!isDatabaseConfigured()) {
    return { name: null, ageYears: null, gender: null, beforePhotoUrl: null };
  }
  const { prisma } = await import("@/lib/prisma");
  const [user, profile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, birthdate: true },
    }),
    prisma.memberProfile.findUnique({
      where: { userId },
      select: { beforePhotoUrl: true, gender: true, ageYears: true },
    }),
  ]);
  const fromBirth = ageYearsFromBirthdate(user?.birthdate ?? null);
  return {
    name: user?.name?.trim() || null,
    ageYears:
      profile?.ageYears != null && Number.isFinite(profile.ageYears)
        ? profile.ageYears
        : fromBirth,
    gender: profile?.gender?.trim() || null,
    beforePhotoUrl: profile?.beforePhotoUrl?.trim() || null,
  };
}

export async function getMemberBeforePhotoUrl(userId: string): Promise<string | null> {
  const id = await getMeasurementSheetIdentity(userId);
  return id.beforePhotoUrl;
}

export async function saveMeasurementSheetIdentity(
  userId: string,
  input: { name?: string | null; ageYears?: number | null; gender?: string | null },
): Promise<MeasurementSheetIdentity> {
  if (!isDatabaseConfigured()) {
    throw new Error("Database is required to save sheet identity.");
  }
  const { prisma } = await import("@/lib/prisma");

  if (input.name !== undefined) {
    const name = input.name?.trim() || null;
    await prisma.user.update({
      where: { id: userId },
      data: { name },
    });
  }

  const profilePatch: { gender?: string | null; ageYears?: number | null } = {};
  if (input.gender !== undefined) {
    profilePatch.gender = input.gender?.trim().slice(0, 40) || null;
  }
  if (input.ageYears !== undefined) {
    const n = input.ageYears;
    if (n == null || n === ("" as unknown)) {
      profilePatch.ageYears = null;
    } else {
      const age = Math.round(Number(n));
      if (!Number.isFinite(age) || age < 1 || age > 120) {
        throw new Error("Age must be between 1 and 120.");
      }
      profilePatch.ageYears = age;
    }
  }

  if (Object.keys(profilePatch).length) {
    const existing = await prisma.memberProfile.findUnique({
      where: { userId },
      select: { userId: true },
    });
    if (existing) {
      await prisma.memberProfile.update({
        where: { userId },
        data: profilePatch,
      });
    } else {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (!user?.email) throw new Error("Member profile missing.");
      await prisma.memberProfile.create({
        data: {
          userId,
          email: user.email,
          plan: "explorer",
          ...profilePatch,
        },
      });
    }
  }

  return getMeasurementSheetIdentity(userId);
}

export async function setMemberBeforePhotoUrl(
  userId: string,
  url: string | null,
): Promise<string | null> {
  if (!isDatabaseConfigured()) {
    throw new Error("Database is required to save photos.");
  }
  const { prisma } = await import("@/lib/prisma");
  const next = url?.trim() || null;
  const existing = await prisma.memberProfile.findUnique({
    where: { userId },
    select: { userId: true, email: true, plan: true },
  });
  if (existing) {
    await prisma.memberProfile.update({
      where: { userId },
      data: { beforePhotoUrl: next },
    });
  } else {
    // Minimal profile so early free explorers can still pin a before photo.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user?.email) {
      throw new Error("Create your member profile first, then add a before photo.");
    }
    await prisma.memberProfile.create({
      data: {
        userId,
        email: user.email,
        plan: "explorer",
        beforePhotoUrl: next,
      },
    });
  }
  return next;
}

export async function listUserMeasurements(
  userId: string,
  limit = 50,
): Promise<MeasurementRecord[]> {
  if (!isDatabaseConfigured()) return [];
  const { prisma } = await import("@/lib/prisma");
  const rows = await prisma.userMeasurement.findMany({
    where: { userId },
    orderBy: { measuredAt: "desc" },
    take: Math.min(100, Math.max(1, limit)),
    select: prismaSelect(),
  });
  return rows.map(serializeMeasurementRow);
}

export async function createUserMeasurement(input: {
  userId: string;
  body: Record<string, unknown>;
  source: MeasurementSource;
  recordedByUserId: string | null;
}): Promise<MeasurementRecord> {
  if (!isDatabaseConfigured()) {
    throw new Error("Database is required to save measurements.");
  }
  const { values, notes, photoUrl, measuredAt } = parseMeasurementPayload(input.body);
  const { prisma } = await import("@/lib/prisma");
  const row = await prisma.userMeasurement.create({
    data: {
      userId: input.userId,
      weightLbs: values.weightLbs ?? null,
      neckIn: values.neckIn ?? null,
      shouldersIn: values.shouldersIn ?? null,
      chestIn: values.chestIn ?? null,
      waistIn: values.waistIn ?? null,
      hipsIn: values.hipsIn ?? null,
      leftBicepIn: values.leftBicepIn ?? null,
      rightBicepIn: values.rightBicepIn ?? null,
      leftThighIn: values.leftThighIn ?? null,
      rightThighIn: values.rightThighIn ?? null,
      leftCalfIn: values.leftCalfIn ?? null,
      rightCalfIn: values.rightCalfIn ?? null,
      bodyFatPct: values.bodyFatPct ?? null,
      photoUrl,
      notes,
      measuredAt,
      source: input.source,
      recordedByUserId: input.recordedByUserId,
    },
    select: prismaSelect(),
  });

  // Keep MemberProfile.weightLbs in sync with latest weight when provided.
  if (values.weightLbs != null) {
    try {
      await prisma.memberProfile.updateMany({
        where: { userId: input.userId },
        data: { weightLbs: String(values.weightLbs) },
      });
    } catch {
      /* profile may not exist yet */
    }
  }

  return serializeMeasurementRow(row);
}

export async function deleteUserMeasurement(input: {
  id: string;
  userId: string;
}): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const { prisma } = await import("@/lib/prisma");
  const result = await prisma.userMeasurement.deleteMany({
    where: { id: input.id, userId: input.userId },
  });
  return result.count > 0;
}

export function latestValues(
  rows: MeasurementRecord[],
): MeasurementValues | null {
  if (!rows.length) return null;
  return rows[0];
}
