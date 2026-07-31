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
    notes: true,
    measuredAt: true,
    source: true,
    recordedByUserId: true,
  } as const;
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
  const { values, notes, measuredAt } = parseMeasurementPayload(input.body);
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
