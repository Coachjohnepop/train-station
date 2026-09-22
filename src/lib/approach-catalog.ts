import { prisma } from "@/lib/prisma";
import { SET_APPROACHES, approachLabel, normalizePrescription } from "@/lib/workout-schemes";

export type ApproachRow = {
  id: string;
  slug: string | null;
  label: string;
  description: string;
  sortOrder: number;
  active: boolean;
};

const SEED = SET_APPROACHES.map((row, index) => ({
  slug: row.id,
  label: row.label,
  description: row.label,
  sortOrder: index,
}));

export async function listApproaches(): Promise<ApproachRow[]> {
  await ensureApproachCatalog();
  const rows = await prisma.approach.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    label: row.label,
    description: row.description,
    sortOrder: row.sortOrder,
    active: row.active,
  }));
}

export async function ensureApproachCatalog(): Promise<void> {
  const count = await prisma.approach.count();
  if (count > 0) return;
  await prisma.approach.createMany({ data: SEED });
}

export function approachTextFromCatalog(input: {
  linked?: { label: string; description: string } | null;
  approachCue?: string | null;
  setScheme?: string | null;
  catalog: Pick<ApproachRow, "slug" | "label" | "description">[];
}): string {
  const linked = input.linked?.description?.trim() || input.linked?.label?.trim();
  if (linked) return linked;
  const cue = input.approachCue?.trim();
  if (cue) return cue;
  const scheme = normalizePrescription({ setScheme: input.setScheme }).approach;
  const row = input.catalog.find((item) => item.slug === scheme);
  const fromTable = row?.description?.trim() || row?.label?.trim();
  if (fromTable) return fromTable;
  return approachLabel(scheme);
}
