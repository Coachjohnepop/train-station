import "server-only";

import { isDatabaseConfigured } from "@/lib/database-config";
import { normalizeOnboardGender } from "@/lib/onboard-path";
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
    photoFocusX: true,
    photoFocusY: true,
    photoZoom: true,
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
  startWeightLbs: string | null;
  goalWeightLbs: string | null;
  beforePhotoUrl: string | null;
  beforePhotoFocusX: number | null;
  beforePhotoFocusY: number | null;
  beforePhotoZoom: number | null;
};

export function parsePoundsFromText(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/(\d+(?:\.\d+)?)\s*(?:lb|lbs|pound|pounds)?/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 50 || n > 500) return null;
  return String(Math.round(n * 10) / 10);
}

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
    return {
      name: null,
      ageYears: null,
      gender: null,
      startWeightLbs: null,
      goalWeightLbs: null,
      beforePhotoUrl: null,
      beforePhotoFocusX: 50,
      beforePhotoFocusY: 25,
      beforePhotoZoom: 1,
    };
  }
  const { prisma } = await import("@/lib/prisma");
  const [user, profile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, birthdate: true },
    }),
    prisma.memberProfile.findUnique({
      where: { userId },
      select: {
        beforePhotoUrl: true,
        beforePhotoFocusX: true,
        beforePhotoFocusY: true,
        beforePhotoZoom: true,
        gender: true,
        ageYears: true,
        startWeightLbs: true,
        goalWeightLbs: true,
        weightLbs: true,
      },
    }),
  ]);
  const fromBirth = ageYearsFromBirthdate(user?.birthdate ?? null);
  const start =
    profile?.startWeightLbs?.trim() ||
    profile?.weightLbs?.trim() ||
    null;
  const goal = profile?.goalWeightLbs?.trim() || null;
  return {
    name: user?.name?.trim() || null,
    ageYears:
      profile?.ageYears != null && Number.isFinite(profile.ageYears)
        ? profile.ageYears
        : fromBirth,
    gender: normalizeOnboardGender(profile?.gender),
    startWeightLbs: start,
    goalWeightLbs: goal,
    beforePhotoUrl: profile?.beforePhotoUrl?.trim() || null,
    beforePhotoFocusX: profile?.beforePhotoFocusX ?? 50,
    beforePhotoFocusY: profile?.beforePhotoFocusY ?? 25,
    beforePhotoZoom: profile?.beforePhotoZoom ?? 1,
  };
}

export async function getMemberBeforePhotoUrl(userId: string): Promise<string | null> {
  const id = await getMeasurementSheetIdentity(userId);
  return id.beforePhotoUrl;
}

export async function saveMeasurementSheetIdentity(
  userId: string,
  input: {
    name?: string | null;
    ageYears?: number | null;
    gender?: string | null;
    startWeightLbs?: string | null;
    goalWeightLbs?: string | null;
  },
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

  const profilePatch: {
    gender?: string | null;
    ageYears?: number | null;
    startWeightLbs?: string | null;
    goalWeightLbs?: string | null;
  } = {};
  if (input.gender !== undefined) {
    const raw = input.gender?.trim() || "";
    if (!raw) {
      profilePatch.gender = null;
    } else {
      const normalized = normalizeOnboardGender(raw);
      if (!normalized) {
        throw new Error("Choose man or woman.");
      }
      profilePatch.gender = normalized;
    }
  }
  if (input.startWeightLbs !== undefined) {
    const parsed = parsePoundsFromText(input.startWeightLbs);
    if (input.startWeightLbs && input.startWeightLbs.trim() && !parsed) {
      throw new Error("Starting weight must be between 50 and 500 lbs.");
    }
    profilePatch.startWeightLbs = parsed;
  }
  if (input.goalWeightLbs !== undefined) {
    const parsed = parsePoundsFromText(input.goalWeightLbs);
    if (input.goalWeightLbs && input.goalWeightLbs.trim() && !parsed) {
      throw new Error("Goal weight must be between 50 and 500 lbs.");
    }
    profilePatch.goalWeightLbs = parsed;
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

export async function setMemberBeforePhotoCrop(
  userId: string,
  crop: { focusX: number; focusY: number; zoom: number },
): Promise<void> {
  if (!isDatabaseConfigured()) {
    throw new Error("Database is required to save photo crop.");
  }
  const { prisma } = await import("@/lib/prisma");
  const { normalizePhotoCrop } = await import("@/lib/photo-crop");
  const c = normalizePhotoCrop(crop);
  const existing = await prisma.memberProfile.findUnique({
    where: { userId },
    select: { userId: true },
  });
  if (!existing) {
    throw new Error("Upload a before photo first, then crop.");
  }
  await prisma.memberProfile.update({
    where: { userId },
    data: {
      beforePhotoFocusX: c.focusX,
      beforePhotoFocusY: c.focusY,
      beforePhotoZoom: c.zoom,
    },
  });
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
  const { values, notes, photoUrl, photoFocusX, photoFocusY, photoZoom, measuredAt } =
    parseMeasurementPayload(input.body);
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
      photoFocusX,
      photoFocusY,
      photoZoom,
      notes,
      measuredAt,
      source: input.source,
      recordedByUserId: input.recordedByUserId,
    },
    select: prismaSelect(),
  });

  // Latest check-in weight lives on weightLbs. Do not overwrite startWeightLbs.
  if (values.weightLbs != null) {
    try {
      const existing = await prisma.memberProfile.findUnique({
        where: { userId: input.userId },
        select: { startWeightLbs: true },
      });
      await prisma.memberProfile.updateMany({
        where: { userId: input.userId },
        data: {
          weightLbs: String(values.weightLbs),
          ...(existing && !existing.startWeightLbs?.trim()
            ? { startWeightLbs: String(values.weightLbs) }
            : {}),
        },
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
