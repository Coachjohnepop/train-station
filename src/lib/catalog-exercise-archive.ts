import { prisma } from "@/lib/prisma";
import {
  isDemoMode,
  hydrateDemoExercises,
  loadDemoExercises,
  saveDemoExercises,
} from "@/lib/demo-exercises";
import { requireBlobPersisted } from "@/lib/demo-persistence";
import { deleteCatalogExercise } from "@/lib/delete-catalog-exercise";

export type ArchiveFilter = "active" | "archived" | "all";

export type ExerciseRow = {
  id: string;
  name: string;
  description: string | null;
  videoUrl: string | null;
  tags: string | null;
  defaultSetScheme?: string | null;
  defaultSets?: number | null;
  defaultWeightTier?: string | null;
  archivedAt?: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

function filterByArchive<T extends { archivedAt?: string | Date | null }>(
  list: T[],
  archive: ArchiveFilter,
): T[] {
  if (archive === "active") return list.filter((e) => !e.archivedAt);
  if (archive === "archived") return list.filter((e) => Boolean(e.archivedAt));
  return list;
}

function serializeExercise(row: {
  id: string;
  name: string;
  description: string | null;
  videoUrl: string | null;
  tags: string | null;
  defaultSetScheme?: string | null;
  defaultSets?: number | null;
  defaultWeightTier?: string | null;
  archivedAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}): ExerciseRow {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    videoUrl: row.videoUrl,
    tags: row.tags,
    defaultSetScheme: row.defaultSetScheme ?? null,
    defaultSets: row.defaultSets ?? null,
    defaultWeightTier: row.defaultWeightTier ?? null,
    archivedAt:
      row.archivedAt instanceof Date
        ? row.archivedAt.toISOString()
        : row.archivedAt ?? null,
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt:
      row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  };
}

export async function listCatalogExercises(
  archive: ArchiveFilter = "active",
): Promise<ExerciseRow[]> {
  if (isDemoMode()) {
    await hydrateDemoExercises({ preferFresh: true });
    const list = filterByArchive(loadDemoExercises(), archive);
    return list
      .map((e) => serializeExercise(e))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const where =
    archive === "active"
      ? { archivedAt: null }
      : archive === "archived"
        ? { archivedAt: { not: null } }
        : {};

  const rows = await prisma.exercise.findMany({
    where,
    orderBy: { name: "asc" },
  });
  return rows.map((r) => serializeExercise(r));
}

export async function archiveCatalogExercise(id: string): Promise<ExerciseRow> {
  if (isDemoMode()) {
    await hydrateDemoExercises({ preferFresh: true });
    const list = loadDemoExercises();
    const idx = list.findIndex((e: { id: string }) => e.id === id);
    if (idx === -1) throw new Error("NOT_FOUND");
    const now = new Date().toISOString();
    list[idx] = { ...list[idx], archivedAt: now, updatedAt: now };
    const saveResult = await saveDemoExercises(list);
    requireBlobPersisted(
      saveResult.exercisesBlobSaved && saveResult.seedBlobSaved,
      "Exercise archive",
    );
    return serializeExercise(list[idx]);
  }

  try {
    const row = await prisma.exercise.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
    return serializeExercise(row);
  } catch {
    throw new Error("NOT_FOUND");
  }
}

export async function restoreCatalogExercise(id: string): Promise<ExerciseRow> {
  if (isDemoMode()) {
    await hydrateDemoExercises({ preferFresh: true });
    const list = loadDemoExercises();
    const idx = list.findIndex((e: { id: string }) => e.id === id);
    if (idx === -1) throw new Error("NOT_FOUND");
    const now = new Date().toISOString();
    list[idx] = { ...list[idx], archivedAt: null, updatedAt: now };
    const saveResult = await saveDemoExercises(list);
    requireBlobPersisted(
      saveResult.exercisesBlobSaved && saveResult.seedBlobSaved,
      "Exercise restore",
    );
    return serializeExercise(list[idx]);
  }

  try {
    const row = await prisma.exercise.update({
      where: { id },
      data: { archivedAt: null },
    });
    return serializeExercise(row);
  } catch {
    throw new Error("NOT_FOUND");
  }
}

/**
 * Soft-archive by default. Hard delete only when already archived (or forceHard).
 * Hard delete strips workout refs via deleteCatalogExercise.
 */
export async function deleteOrArchiveCatalogExercise(
  id: string,
  opts?: { hard?: boolean; forceHard?: boolean },
): Promise<{
  mode: "archived" | "deleted";
  removedFromWorkouts?: number;
  exercise?: ExerciseRow;
}> {
  const hard = opts?.hard === true;
  const forceHard = opts?.forceHard === true;

  if (!hard) {
    const exercise = await archiveCatalogExercise(id);
    return { mode: "archived", exercise };
  }

  if (isDemoMode()) {
    await hydrateDemoExercises({ preferFresh: true });
    const list = loadDemoExercises();
    const idx = list.findIndex((e: { id: string }) => e.id === id);
    if (idx === -1) throw new Error("NOT_FOUND");
    const row = list[idx];
    if (!row.archivedAt && !forceHard) throw new Error("NOT_ARCHIVED");
    list.splice(idx, 1);
    const { mutateDemoSeed } = await import("@/lib/demo-seed-store");
    await mutateDemoSeed((seed) => {
      if (!seed.workoutExercises) return;
      seed.workoutExercises = (
        seed.workoutExercises as Array<{ exerciseId?: string }>
      ).filter((we) => we.exerciseId !== id);
    });
    const saveResult = await saveDemoExercises(list);
    requireBlobPersisted(
      saveResult.exercisesBlobSaved && saveResult.seedBlobSaved,
      "Exercise hard delete",
    );
    return { mode: "deleted", removedFromWorkouts: 0 };
  }

  const existing = await prisma.exercise.findUnique({
    where: { id },
    select: { id: true, archivedAt: true },
  });
  if (!existing) throw new Error("NOT_FOUND");
  if (!existing.archivedAt && !forceHard) throw new Error("NOT_ARCHIVED");

  const { removedFromWorkouts } = await deleteCatalogExercise(id);
  return { mode: "deleted", removedFromWorkouts };
}
