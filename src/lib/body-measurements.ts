/**
 * Body measurement check-ins — shared field catalog for member + coach UIs.
 * Units: weight lbs, girths inches, body fat %.
 */

export type MeasurementSource = "member" | "coach";

export type MeasurementFieldId =
  | "weightLbs"
  | "neckIn"
  | "shouldersIn"
  | "chestIn"
  | "waistIn"
  | "hipsIn"
  | "leftBicepIn"
  | "rightBicepIn"
  | "leftThighIn"
  | "rightThighIn"
  | "leftCalfIn"
  | "rightCalfIn"
  | "bodyFatPct";

export type MeasurementFieldDef = {
  id: MeasurementFieldId;
  label: string;
  unit: "lbs" | "in" | "%";
  /** Hint under the input */
  hint?: string;
  min: number;
  max: number;
  step: number;
};

export const MEASUREMENT_FIELDS: MeasurementFieldDef[] = [
  {
    id: "weightLbs",
    label: "Weight",
    unit: "lbs",
    hint: "Scale weight",
    min: 50,
    max: 500,
    step: 0.1,
  },
  {
    id: "neckIn",
    label: "Neck",
    unit: "in",
    min: 8,
    max: 30,
    step: 0.1,
  },
  {
    id: "shouldersIn",
    label: "Shoulders",
    unit: "in",
    min: 20,
    max: 80,
    step: 0.1,
  },
  {
    id: "chestIn",
    label: "Chest",
    unit: "in",
    hint: "Around fullest part, relaxed",
    min: 20,
    max: 80,
    step: 0.1,
  },
  {
    id: "waistIn",
    label: "Waist",
    unit: "in",
    hint: "Narrowest point, usually navel",
    min: 15,
    max: 80,
    step: 0.1,
  },
  {
    id: "hipsIn",
    label: "Hips",
    unit: "in",
    hint: "Widest part of glutes",
    min: 20,
    max: 80,
    step: 0.1,
  },
  {
    id: "leftBicepIn",
    label: "Left bicep",
    unit: "in",
    min: 5,
    max: 30,
    step: 0.1,
  },
  {
    id: "rightBicepIn",
    label: "Right bicep",
    unit: "in",
    min: 5,
    max: 30,
    step: 0.1,
  },
  {
    id: "leftThighIn",
    label: "Left thigh",
    unit: "in",
    min: 10,
    max: 50,
    step: 0.1,
  },
  {
    id: "rightThighIn",
    label: "Right thigh",
    unit: "in",
    min: 10,
    max: 50,
    step: 0.1,
  },
  {
    id: "leftCalfIn",
    label: "Left calf",
    unit: "in",
    min: 8,
    max: 30,
    step: 0.1,
  },
  {
    id: "rightCalfIn",
    label: "Right calf",
    unit: "in",
    min: 8,
    max: 30,
    step: 0.1,
  },
  {
    id: "bodyFatPct",
    label: "Body fat",
    unit: "%",
    hint: "Optional — calipers, DEXA, or estimate",
    min: 2,
    max: 70,
    step: 0.1,
  },
];

export type MeasurementValues = Partial<Record<MeasurementFieldId, number | null>>;

export type MeasurementRecord = MeasurementValues & {
  id: string;
  userId: string;
  notes: string | null;
  /** Progress photo for this check-in (“now”). */
  photoUrl: string | null;
  measuredAt: string;
  source: MeasurementSource;
  recordedByUserId: string | null;
};

export function emptyMeasurementForm(): Record<MeasurementFieldId, string> {
  const out = {} as Record<MeasurementFieldId, string>;
  for (const f of MEASUREMENT_FIELDS) out[f.id] = "";
  return out;
}

export function formFromRecord(
  row: MeasurementValues | null | undefined,
): Record<MeasurementFieldId, string> {
  const out = emptyMeasurementForm();
  if (!row) return out;
  for (const f of MEASUREMENT_FIELDS) {
    const v = row[f.id];
    if (v != null && Number.isFinite(v)) out[f.id] = String(v);
  }
  return out;
}

export function parseOptionalNumber(
  raw: unknown,
  field: MeasurementFieldDef,
): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n)) return null;
  if (n < field.min || n > field.max) {
    throw new Error(`${field.label} must be between ${field.min} and ${field.max}.`);
  }
  return Math.round(n * 10) / 10;
}

export function parseMeasurementPayload(body: Record<string, unknown>): {
  values: MeasurementValues;
  notes: string | null;
  photoUrl: string | null;
  measuredAt: Date;
} {
  const values: MeasurementValues = {};
  let any = false;
  for (const f of MEASUREMENT_FIELDS) {
    try {
      const n = parseOptionalNumber(body[f.id], f);
      values[f.id] = n;
      if (n != null) any = true;
    } catch (e) {
      throw e;
    }
  }
  const notesRaw = typeof body.notes === "string" ? body.notes.trim() : "";
  const notes = notesRaw ? notesRaw.slice(0, 2000) : null;
  if (notes) any = true;

  let photoUrl: string | null = null;
  if (typeof body.photoUrl === "string" && body.photoUrl.trim()) {
    photoUrl = body.photoUrl.trim().slice(0, 800);
    any = true;
  }

  if (!any) {
    throw new Error("Enter at least one measurement, a photo, or a note.");
  }

  let measuredAt = new Date();
  if (typeof body.measuredAt === "string" && body.measuredAt.trim()) {
    const d = new Date(body.measuredAt);
    if (!Number.isNaN(d.getTime())) measuredAt = d;
  }

  return { values, notes, photoUrl, measuredAt };
}

export function formatMeasurementValue(
  value: number | null | undefined,
  unit: MeasurementFieldDef["unit"],
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const n = Number.isInteger(value) ? String(value) : value.toFixed(1);
  if (unit === "lbs") return `${n} lb`;
  if (unit === "%") return `${n}%`;
  return `${n}"`;
}

export function deltaLabel(
  current: number | null | undefined,
  previous: number | null | undefined,
): string | null {
  if (current == null || previous == null) return null;
  const d = Math.round((current - previous) * 10) / 10;
  if (d === 0) return "0";
  return d > 0 ? `+${d}` : String(d);
}

/** Serialize Prisma row → API shape. */
export function serializeMeasurementRow(row: {
  id: string;
  userId: string;
  weightLbs: number | null;
  neckIn?: number | null;
  shouldersIn?: number | null;
  chestIn?: number | null;
  waistIn?: number | null;
  hipsIn?: number | null;
  leftBicepIn?: number | null;
  rightBicepIn?: number | null;
  leftThighIn?: number | null;
  rightThighIn?: number | null;
  leftCalfIn?: number | null;
  rightCalfIn?: number | null;
  bodyFatPct?: number | null;
  photoUrl?: string | null;
  notes: string | null;
  measuredAt: Date | string;
  source?: string | null;
  recordedByUserId?: string | null;
}): MeasurementRecord {
  const measuredAt =
    row.measuredAt instanceof Date
      ? row.measuredAt.toISOString()
      : new Date(row.measuredAt).toISOString();
  const source: MeasurementSource = row.source === "coach" ? "coach" : "member";
  return {
    id: row.id,
    userId: row.userId,
    weightLbs: row.weightLbs ?? null,
    neckIn: row.neckIn ?? null,
    shouldersIn: row.shouldersIn ?? null,
    chestIn: row.chestIn ?? null,
    waistIn: row.waistIn ?? null,
    hipsIn: row.hipsIn ?? null,
    leftBicepIn: row.leftBicepIn ?? null,
    rightBicepIn: row.rightBicepIn ?? null,
    leftThighIn: row.leftThighIn ?? null,
    rightThighIn: row.rightThighIn ?? null,
    leftCalfIn: row.leftCalfIn ?? null,
    rightCalfIn: row.rightCalfIn ?? null,
    bodyFatPct: row.bodyFatPct ?? null,
    photoUrl: row.photoUrl ?? null,
    notes: row.notes ?? null,
    measuredAt,
    source,
    recordedByUserId: row.recordedByUserId ?? null,
  };
}
