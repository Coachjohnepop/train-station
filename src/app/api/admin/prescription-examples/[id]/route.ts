import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/api-auth";
import { buildPrescriptionSummary } from "@/lib/prescription-example-summary";
import {
  PRESCRIPTION_PATTERN_TYPES,
  type PhaseTypeValue,
  type PrescriptionExampleRow,
  type RepKindValue,
} from "@/lib/prescription-example-types";
import { updatePrescriptionExample } from "@/lib/prescription-examples-db";

const patchSchema = z.object({
  patternType: z.enum(PRESCRIPTION_PATTERN_TYPES),
  sampleExercise: z.string().min(1).max(200),
  setCount: z.number().int().min(1).max(10),
  restBetweenSetsSec: z.number().int().min(0).max(600),
  weightTier: z.string().min(1).max(40),
  phase1Type: z.string().max(20).optional(),
  phase1DurationSec: z.number().int().nullable().optional(),
  phase1Reps: z.number().int().nullable().optional(),
  phase1RepKind: z.string().max(20).optional(),
  phase1PositionCue: z.string().max(200).optional(),
  phase2Type: z.string().max(20).optional(),
  phase2DurationSec: z.number().int().nullable().optional(),
  phase2Reps: z.number().int().nullable().optional(),
  phase2RepKind: z.string().max(20).optional(),
  phase2PositionCue: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
  summary: z.string().max(500).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const { id: idRaw } = await params;
  const id = Number(idRaw);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ detail: "Invalid example id" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const base: Omit<PrescriptionExampleRow, "summary"> = {
    id,
    patternType: data.patternType,
    sampleExercise: data.sampleExercise,
    setCount: data.setCount,
    restBetweenSetsSec: data.restBetweenSetsSec,
    weightTier: data.weightTier,
    phase1Type: (data.phase1Type ?? "") as PhaseTypeValue,
    phase1DurationSec: data.phase1DurationSec ?? null,
    phase1Reps: data.phase1Reps ?? null,
    phase1RepKind: (data.phase1RepKind ?? "") as RepKindValue,
    phase1PositionCue: data.phase1PositionCue ?? "",
    phase2Type: (data.phase2Type ?? "") as PhaseTypeValue,
    phase2DurationSec: data.phase2DurationSec ?? null,
    phase2Reps: data.phase2Reps ?? null,
    phase2RepKind: (data.phase2RepKind ?? "") as RepKindValue,
    phase2PositionCue: data.phase2PositionCue ?? "",
    notes: data.notes ?? "",
  };
  const row: PrescriptionExampleRow = {
    ...base,
    summary: data.summary || buildPrescriptionSummary(base),
  };

  const updated = await updatePrescriptionExample(id, row);
  if (!updated) {
    return NextResponse.json({ detail: "Example not found" }, { status: 404 });
  }

  return NextResponse.json({ example: updated });
}