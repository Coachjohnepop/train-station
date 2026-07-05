import "server-only";

import { isDemoMode } from "@/lib/demo-enrollments";
import type { PrescriptionExampleRow } from "@/lib/prescription-example-types";
import { loadPrescriptionExamplesFromCsv } from "@/lib/prescription-examples-csv";
import { prisma } from "@/lib/prisma";

function rowFromDb(row: {
  id: number;
  patternType: string;
  sampleExercise: string;
  setCount: number;
  restBetweenSetsSec: number;
  weightTier: string;
  phase1Type: string | null;
  phase1DurationSec: number | null;
  phase1Reps: number | null;
  phase1RepKind: string | null;
  phase1PositionCue: string | null;
  phase2Type: string | null;
  phase2DurationSec: number | null;
  phase2Reps: number | null;
  phase2RepKind: string | null;
  phase2PositionCue: string | null;
  notes: string | null;
  summary: string;
}): PrescriptionExampleRow {
  return {
    id: row.id,
    patternType: row.patternType as PrescriptionExampleRow["patternType"],
    sampleExercise: row.sampleExercise,
    setCount: row.setCount,
    restBetweenSetsSec: row.restBetweenSetsSec,
    weightTier: row.weightTier,
    phase1Type: (row.phase1Type ?? "") as PrescriptionExampleRow["phase1Type"],
    phase1DurationSec: row.phase1DurationSec,
    phase1Reps: row.phase1Reps,
    phase1RepKind: (row.phase1RepKind ?? "") as PrescriptionExampleRow["phase1RepKind"],
    phase1PositionCue: row.phase1PositionCue ?? "",
    phase2Type: (row.phase2Type ?? "") as PrescriptionExampleRow["phase2Type"],
    phase2DurationSec: row.phase2DurationSec,
    phase2Reps: row.phase2Reps,
    phase2RepKind: (row.phase2RepKind ?? "") as PrescriptionExampleRow["phase2RepKind"],
    phase2PositionCue: row.phase2PositionCue ?? "",
    notes: row.notes ?? "",
    summary: row.summary,
  };
}

function rowToDbData(row: PrescriptionExampleRow) {
  return {
    patternType: row.patternType,
    sampleExercise: row.sampleExercise,
    setCount: row.setCount,
    restBetweenSetsSec: row.restBetweenSetsSec,
    weightTier: row.weightTier,
    phase1Type: row.phase1Type || null,
    phase1DurationSec: row.phase1DurationSec,
    phase1Reps: row.phase1Reps,
    phase1RepKind: row.phase1RepKind || null,
    phase1PositionCue: row.phase1PositionCue || null,
    phase2Type: row.phase2Type || null,
    phase2DurationSec: row.phase2DurationSec,
    phase2Reps: row.phase2Reps,
    phase2RepKind: row.phase2RepKind || null,
    phase2PositionCue: row.phase2PositionCue || null,
    notes: row.notes || null,
    summary: row.summary,
  };
}

export async function ensurePrescriptionExamplesSeeded(): Promise<void> {
  if (isDemoMode()) return;
  const count = await prisma.prescriptionExample.count();
  if (count > 0) return;
  const rows = loadPrescriptionExamplesFromCsv();
  if (!rows.length) return;
  await prisma.prescriptionExample.createMany({
    data: rows.map((row) => ({
      id: row.id,
      ...rowToDbData(row),
      updatedAt: new Date(),
    })),
    skipDuplicates: true,
  });
}

export async function listPrescriptionExamples(): Promise<PrescriptionExampleRow[]> {
  if (isDemoMode()) return loadPrescriptionExamplesFromCsv();
  await ensurePrescriptionExamplesSeeded();
  const rows = await prisma.prescriptionExample.findMany({ orderBy: { id: "asc" } });
  if (!rows.length) return loadPrescriptionExamplesFromCsv();
  return rows.map(rowFromDb);
}

export async function updatePrescriptionExample(
  id: number,
  row: PrescriptionExampleRow,
): Promise<PrescriptionExampleRow | null> {
  if (isDemoMode()) return row;
  await ensurePrescriptionExamplesSeeded();
  const updated = await prisma.prescriptionExample.update({
    where: { id },
    data: rowToDbData(row),
  });
  return rowFromDb(updated);
}