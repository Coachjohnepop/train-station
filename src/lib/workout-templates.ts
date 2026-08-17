/**
 * Coach workout template library.
 * Promote = deep-clone source into a protected template workout + metadata row.
 * Paste = always clone again onto a program day (never share by reference).
 */

import { isCoachCatalogDemo } from "@/lib/catalog-mode";
import { cloneWorkout } from "@/lib/clone-workout";
import { prisma } from "@/lib/prisma";
import { getDemoSeed, mutateDemoSeed } from "@/lib/demo-seed-store";
import { BLOB_TOKEN } from "@/lib/demo-json-blob";
import { requireBlobPersisted } from "@/lib/demo-persistence";
import { cloneWorkoutContentName, workoutContentTitle } from "@/lib/workout-content-name";
import { TEMPLATE_CATEGORIES } from "@/lib/workout-template-constants";

export type WorkoutTemplateRecord = {
  id: string;
  name: string;
  category: string;
  versionLabel: string | null;
  notes: string | null;
  workoutId: string;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  exerciseCount?: number;
  workoutName?: string;
};

export function normalizeTemplateCategory(raw?: string | null): string {
  const c = (raw || "general").trim().toLowerCase() || "general";
  return c.slice(0, 40);
}

function demoTemplatesFromSeed(data: Record<string, unknown>): WorkoutTemplateRecord[] {
  const list = (data.workoutTemplates as WorkoutTemplateRecord[] | undefined) || [];
  const workouts = (data.workouts as any[]) || [];
  const items = (data.workoutExercises as any[]) || [];
  return list
    .map((t) => {
      const w = workouts.find((x) => x.id === t.workoutId);
      const exerciseCount = items.filter((we) => we.workoutId === t.workoutId).length;
      return {
        ...t,
        exerciseCount,
        workoutName: w?.name || t.name,
      };
    })
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

export async function listWorkoutTemplates(opts?: {
  category?: string;
  /** Default: active only. "archived" | "all" for look-back shelf. */
  archive?: "active" | "archived" | "all";
}): Promise<WorkoutTemplateRecord[]> {
  const archive = opts?.archive || "active";

  if (isCoachCatalogDemo()) {
    const seed = await getDemoSeed({ preferFresh: true });
    let list = demoTemplatesFromSeed(seed as Record<string, unknown>);
    if (opts?.category) {
      const cat = normalizeTemplateCategory(opts.category);
      list = list.filter((t) => t.category === cat);
    }
    if (archive === "active") list = list.filter((t) => !t.archivedAt);
    if (archive === "archived") list = list.filter((t) => Boolean(t.archivedAt));
    return list;
  }

  const where: Record<string, unknown> = {};
  if (opts?.category) where.category = normalizeTemplateCategory(opts.category);
  if (archive === "active") where.archivedAt = null;
  if (archive === "archived") where.archivedAt = { not: null };

  const rows = await prisma.workoutTemplate.findMany({
    where,
    // Newest first so coaches see what they just saved at the top of the picker.
    orderBy: [{ createdAt: "desc" }, { updatedAt: "desc" }],
    include: {
      workout: {
        select: {
          id: true,
          name: true,
          _count: { select: { exercises: true } },
        },
      },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    versionLabel: r.versionLabel,
    notes: r.notes,
    workoutId: r.workoutId,
    archivedAt: r.archivedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    exerciseCount: r.workout._count.exercises,
    workoutName: r.workout.name,
  }));
}

/** Promote a live workout into the template library (always clones first). */
export async function promoteWorkoutToTemplate(input: {
  sourceWorkoutId: string;
  name: string;
  category?: string;
  versionLabel?: string | null;
  notes?: string | null;
}): Promise<WorkoutTemplateRecord> {
  const name = input.name.trim();
  if (!name || name.length < 2) throw new Error("NAME_REQUIRED");
  const category = normalizeTemplateCategory(input.category);
  const versionLabel = input.versionLabel?.trim() || null;
  const notes = input.notes?.trim() || null;

  const titleBits = [name];
  if (versionLabel) titleBits.push(versionLabel);
  const templateWorkoutName = titleBits.join(" · ");

  const cloned = await cloneWorkout(input.sourceWorkoutId, templateWorkoutName);

  if (isCoachCatalogDemo()) {
    const now = new Date().toISOString();
    const row: WorkoutTemplateRecord = {
      id: `tmpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      category,
      versionLabel,
      notes,
      workoutId: cloned.id,
      createdAt: now,
      updatedAt: now,
      exerciseCount: undefined,
      workoutName: cloned.name,
    };

    const { blobSaved } = await mutateDemoSeed((data) => {
      if (!data.workoutTemplates) data.workoutTemplates = [];
      (data.workoutTemplates as WorkoutTemplateRecord[]).push(row);
      const workouts = (data.workouts as any[]) || [];
      const w = workouts.find((x) => x.id === cloned.id);
      if (w) w.source = "template";
    }, { preferFresh: true });
    requireBlobPersisted(blobSaved, "Template promote");

    const seed = await getDemoSeed({ preferFresh: Boolean(BLOB_TOKEN) });
    const found = demoTemplatesFromSeed(seed as Record<string, unknown>).find(
      (t) => t.id === row.id,
    );
    if (!found) throw new Error("PROMOTE_VERIFY_FAILED");
    return found;
  }

  await prisma.workout.update({
    where: { id: cloned.id },
    data: { source: "template" },
  });

  const created = await prisma.workoutTemplate.create({
    data: {
      name,
      category,
      versionLabel,
      notes,
      workoutId: cloned.id,
    },
    include: {
      workout: {
        select: {
          id: true,
          name: true,
          _count: { select: { exercises: true } },
        },
      },
    },
  });

  return {
    id: created.id,
    name: created.name,
    category: created.category,
    versionLabel: created.versionLabel,
    notes: created.notes,
    workoutId: created.workoutId,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
    exerciseCount: created.workout._count.exercises,
    workoutName: created.workout.name,
  };
}

/**
 * Soft-archive (default) or permanent delete.
 * - archive: hide from active library (look-back shelf)
 * - hard: only allowed if already archived (or forceHard)
 */
export async function archiveWorkoutTemplate(id: string): Promise<WorkoutTemplateRecord> {
  if (isCoachCatalogDemo()) {
    let updated: WorkoutTemplateRecord | null = null;
    const { blobSaved } = await mutateDemoSeed((data) => {
      const list = (data.workoutTemplates as WorkoutTemplateRecord[]) || [];
      const row = list.find((t) => t.id === id);
      if (!row) throw new Error("TEMPLATE_NOT_FOUND");
      row.archivedAt = new Date().toISOString();
      row.updatedAt = row.archivedAt;
      updated = row;
    }, { preferFresh: true });
    requireBlobPersisted(blobSaved, "Template archive");
    return updated!;
  }

  const existing = await prisma.workoutTemplate.findUnique({
    where: { id },
    include: {
      workout: { select: { id: true, name: true, _count: { select: { exercises: true } } } },
    },
  });
  if (!existing) throw new Error("TEMPLATE_NOT_FOUND");
  const row = await prisma.workoutTemplate.update({
    where: { id },
    data: { archivedAt: new Date() },
    include: {
      workout: { select: { id: true, name: true, _count: { select: { exercises: true } } } },
    },
  });
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    versionLabel: row.versionLabel,
    notes: row.notes,
    workoutId: row.workoutId,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    exerciseCount: row.workout._count.exercises,
    workoutName: row.workout.name,
  };
}

export async function restoreWorkoutTemplate(id: string): Promise<WorkoutTemplateRecord> {
  if (isCoachCatalogDemo()) {
    let updated: WorkoutTemplateRecord | null = null;
    const { blobSaved } = await mutateDemoSeed((data) => {
      const list = (data.workoutTemplates as WorkoutTemplateRecord[]) || [];
      const row = list.find((t) => t.id === id);
      if (!row) throw new Error("TEMPLATE_NOT_FOUND");
      row.archivedAt = null;
      row.updatedAt = new Date().toISOString();
      updated = row;
    }, { preferFresh: true });
    requireBlobPersisted(blobSaved, "Template restore");
    return updated!;
  }

  const existing = await prisma.workoutTemplate.findUnique({ where: { id } });
  if (!existing) throw new Error("TEMPLATE_NOT_FOUND");
  const row = await prisma.workoutTemplate.update({
    where: { id },
    data: { archivedAt: null },
    include: {
      workout: { select: { id: true, name: true, _count: { select: { exercises: true } } } },
    },
  });
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    versionLabel: row.versionLabel,
    notes: row.notes,
    workoutId: row.workoutId,
    archivedAt: null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    exerciseCount: row.workout._count.exercises,
    workoutName: row.workout.name,
  };
}

/** Permanent delete — only if already archived (unless force). */
export async function deleteWorkoutTemplate(
  id: string,
  opts?: { hard?: boolean; forceHard?: boolean },
): Promise<{ mode: "archived" | "deleted" }> {
  const hard = opts?.hard === true;
  const forceHard = opts?.forceHard === true;

  if (!hard) {
    await archiveWorkoutTemplate(id);
    return { mode: "archived" };
  }

  if (isCoachCatalogDemo()) {
    const { blobSaved } = await mutateDemoSeed((data) => {
      const list = (data.workoutTemplates as WorkoutTemplateRecord[]) || [];
      const idx = list.findIndex((t) => t.id === id);
      if (idx < 0) throw new Error("TEMPLATE_NOT_FOUND");
      const row = list[idx];
      if (!row.archivedAt && !forceHard) throw new Error("NOT_ARCHIVED");
      const [removed] = list.splice(idx, 1);
      data.workoutTemplates = list;
      const workouts = (data.workouts as any[]) || [];
      const w = workouts.find((x) => x.id === removed.workoutId);
      if (w) w.source = "catalog";
    }, { preferFresh: true });
    requireBlobPersisted(blobSaved, "Template hard delete");
    return { mode: "deleted" };
  }

  const existing = await prisma.workoutTemplate.findUnique({ where: { id } });
  if (!existing) throw new Error("TEMPLATE_NOT_FOUND");
  if (!existing.archivedAt && !forceHard) throw new Error("NOT_ARCHIVED");

  await prisma.workoutTemplate.delete({ where: { id } });
  await prisma.workout
    .update({
      where: { id: existing.workoutId },
      data: { source: "catalog" },
    })
    .catch(() => {});
  return { mode: "deleted" };
}

/**
 * Paste a template (or any workout) onto a program day.
 * Always clones. Tracks: gym and/or home (deselect either).
 */
export async function pasteWorkoutOntoProgramDay(input: {
  sourceWorkoutId: string;
  dayId: string;
  tracks: { gym?: boolean; home?: boolean };
  /** When true, replace existing track workouts; when false, only fill empty tracks. */
  replace?: boolean;
  /**
   * Multi-part day: paste onto this part (1 = Main/AM).
   * Defaults to 1. Clamped to the day's partCount.
   */
  partIndex?: number;
  /**
   * When true and tracks already have workouts, throw NEEDS_CONFIRM instead of replacing
   * unless replace was explicitly forced after coach confirm.
   * Callers use replace:false first, then replace:true after confirm.
   */
  requireConfirmIfOccupied?: boolean;
  /**
   * Required when pasting from the template library: coach must give the copy a new title
   * (different from the source template / workout name) so weeks don't share identical labels.
   */
  contentName?: string | null;
  /** Source template display name (for rename check). */
  sourceTemplateName?: string | null;
  /** When true, contentName is required and must differ from source. */
  requireRename?: boolean;
}): Promise<{
  dayId: string;
  gymWorkoutId?: string;
  homeWorkoutId?: string;
  cloned: string[];
  partIndex: number;
  needsConfirm?: boolean;
  occupiedTracks?: string[];
}> {
  const gym = input.tracks.gym === true;
  const home = input.tracks.home === true;
  if (!gym && !home) {
    throw new Error("SELECT_TRACK");
  }

  const sourceName = await resolveSourceWorkoutName(input.sourceWorkoutId);
  const sourceTitle = workoutContentTitle(
    input.sourceTemplateName?.trim() || sourceName,
  );
  const requestedTitle = (input.contentName || "").trim();
  let baseTitle = workoutContentTitle(requestedTitle || sourceName);
  if (!baseTitle || /^workout$/i.test(baseTitle)) {
    baseTitle = cloneWorkoutContentName(sourceName || requestedTitle || "Unassigned");
  }

  if (input.requireRename) {
    if (!requestedTitle) {
      throw new Error("RENAME_REQUIRED");
    }
    const next = workoutContentTitle(requestedTitle);
    const prev = sourceTitle;
    if (!next || next.toLowerCase() === (prev || "").toLowerCase()) {
      throw new Error("RENAME_REQUIRED");
    }
    baseTitle = next;
  }

  const replace = input.replace !== false;
  const cloned: string[] = [];
  let gymWorkoutId: string | undefined;
  let homeWorkoutId: string | undefined;

  if (isCoachCatalogDemo()) {
    const seed = await getDemoSeed({ preferFresh: true });
    // Program days in seed — use program day options via API pattern
    // Demo path: still clone workouts and return IDs; caller (API) patches day via existing program day routes if needed.
    // For demo we update seed program structure if present.
  }

  // Resolve day options from DB (prod path) or demo
  if (!isCoachCatalogDemo()) {
    const { resolveSessionIdForPart } = await import("@/lib/program-day-sessions-db");

    const day = await prisma.programDay.findUnique({
      where: { id: input.dayId },
      include: {
        options: { orderBy: { sortOrder: "asc" } },
        sessions: { orderBy: { partIndex: "asc" } },
      },
    });
    if (!day) throw new Error("DAY_NOT_FOUND");

    // Grow the day if coach pastes onto part 2/3 before partCount has fully settled.
    const rawPart = typeof input.partIndex === "number" ? input.partIndex : 1;
    const requestedPart = Math.min(5, Math.max(1, Math.round(rawPart)));
    const maxParts = Math.max(
      day.partCount || 1,
      day.sessions?.length || 1,
      requestedPart,
      1,
    );
    const partIndex = Math.min(requestedPart, maxParts);
    const sessionId = await resolveSessionIdForPart(day.id, partIndex, maxParts);

    type Opt = {
      workoutId: string;
      label: string;
      trainingLocation?: string | null;
      notes?: string | null;
      sortOrder?: number;
      sessionId?: string | null;
    };
    // Prefer options already on this session / part (legacy null session only for part 1).
    const partOpts = day.options.filter((o) => {
      if (o.sessionId === sessionId) return true;
      if (partIndex === 1 && o.sessionId == null) return true;
      return false;
    });
    const opts: Opt[] = (partOpts.length ? partOpts : []).map((o) => ({
      workoutId: o.workoutId,
      label: o.label,
      trainingLocation: o.trainingLocation,
      notes: o.notes,
      sortOrder: o.sortOrder,
      sessionId: o.sessionId ?? sessionId,
    }));

    // Soft confirm when selected tracks already have workouts
    if (replace && input.requireConfirmIfOccupied) {
      const occupied: string[] = [];
      for (const track of [
        { want: gym, label: "Gym", loc: "gym" as const },
        { want: home, label: "Home", loc: "home" as const },
      ]) {
        if (!track.want) continue;
        const hit = opts.find(
          (o) =>
            o.workoutId &&
            (o.label.toLowerCase() === track.label.toLowerCase() ||
              o.trainingLocation === track.loc),
        );
        if (hit) occupied.push(track.label);
      }
      if (occupied.length > 0) {
        const err = new Error("NEEDS_CONFIRM") as Error & {
          occupiedTracks?: string[];
          partIndex?: number;
        };
        err.occupiedTracks = occupied;
        err.partIndex = partIndex;
        throw err;
      }
    }

    const ensureTrack = async (
      label: "Gym" | "Home",
      loc: "gym" | "home",
    ) => {
      let idx = opts.findIndex(
        (o) =>
          o.label.toLowerCase() === label.toLowerCase() ||
          o.trainingLocation === loc,
      );
      if (idx < 0) {
        opts.push({
          workoutId: "",
          label,
          trainingLocation: loc,
          sortOrder: loc === "gym" ? 0 : 1,
          sessionId,
        });
        idx = opts.length - 1;
      }
      const existing = opts[idx];
      if (!replace && existing.workoutId) {
        if (loc === "gym") gymWorkoutId = existing.workoutId;
        else homeWorkoutId = existing.workoutId;
        return;
      }
      const clonedW = await cloneWorkout(
        input.sourceWorkoutId,
        baseTitle,
      );
      cloned.push(clonedW.id);
      opts[idx] = {
        ...existing,
        workoutId: clonedW.id,
        label,
        trainingLocation: loc,
        sessionId,
      };
      if (loc === "gym") gymWorkoutId = clonedW.id;
      else homeWorkoutId = clonedW.id;
    };

    if (gym) await ensureTrack("Gym", "gym");
    if (home) await ensureTrack("Home", "home");

    // Keep non-gym/home options (day off etc.) — if we have gym/home, drop day-off
    const cleaned = opts.filter((o) => {
      if (/^day\s*off$/i.test(o.label)) return false;
      if (/fasted/i.test(o.label) && (gym || home)) return false;
      return true;
    });

    // Only replace options on this session (legacy null only when pasting part 1).
    await prisma.programDayOption.deleteMany({
      where: {
        dayId: day.id,
        OR:
          partIndex === 1
            ? [{ sessionId }, { sessionId: null }]
            : [{ sessionId }],
      },
    });
    if (cleaned.length) {
      await prisma.programDayOption.createMany({
        data: cleaned
          .filter((o) => o.workoutId)
          .map((o, i) => ({
            dayId: day.id,
            sessionId,
            workoutId: o.workoutId,
            label: o.label,
            trainingLocation: o.trainingLocation ?? null,
            notes: o.notes ?? null,
            sortOrder: i,
          })),
      });
    }
    // Only update day.workoutId for part 1 (legacy primary).
    if (partIndex === 1) {
      await prisma.programDay.update({
        where: { id: day.id },
        data: {
          workoutId: gymWorkoutId || homeWorkoutId || day.workoutId || null,
        },
      });
    }

    return { dayId: day.id, gymWorkoutId, homeWorkoutId, cloned, partIndex };
  }

  // Demo catalog mode: clone workouts + patch program days in seed if present
  if (gym) {
    const c = await cloneWorkout(input.sourceWorkoutId, baseTitle);
    cloned.push(c.id);
    gymWorkoutId = c.id;
  }
  if (home) {
    const c = await cloneWorkout(input.sourceWorkoutId, baseTitle);
    cloned.push(c.id);
    homeWorkoutId = c.id;
  }

  const demoPartIndex = Math.max(1, Math.round(input.partIndex ?? 1));

  await mutateDemoSeed((data) => {
    // Best-effort: find day in programs[].weeks[].days[]
    const programs = (data.programs as any[]) || [];
    for (const p of programs) {
      for (const w of p.weeks || []) {
        for (const d of w.days || []) {
          if (d.id !== input.dayId) continue;
          const nextOpts: any[] = [];
          if (gym && gymWorkoutId) {
            nextOpts.push({
              workoutId: gymWorkoutId,
              label: "Gym",
              trainingLocation: "gym",
              sortOrder: 0,
              partIndex: demoPartIndex,
            });
          }
          if (home && homeWorkoutId) {
            nextOpts.push({
              workoutId: homeWorkoutId,
              label: "Home",
              trainingLocation: "home",
              sortOrder: 1,
              partIndex: demoPartIndex,
            });
          }
          // Preserve other tracks if not replacing fully
          if (!replace && Array.isArray(d.options)) {
            for (const o of d.options) {
              const isGym = /^gym$/i.test(o.label) || o.trainingLocation === "gym";
              const isHome = /^home$/i.test(o.label) || o.trainingLocation === "home";
              if (gym && isGym) continue;
              if (home && isHome) continue;
              nextOpts.push(o);
            }
          }
          d.options = nextOpts;
          d.workoutId = gymWorkoutId || homeWorkoutId || d.workoutId;
          return;
        }
      }
    }
  }, { preferFresh: true });

  return {
    dayId: input.dayId,
    gymWorkoutId,
    homeWorkoutId,
    cloned,
    partIndex: demoPartIndex,
  };
}

async function resolveSourceWorkoutName(workoutId: string): Promise<string> {
  if (isCoachCatalogDemo()) {
    const seed = await getDemoSeed({ preferFresh: true });
    const w = ((seed.workouts as any[]) || []).find((x) => x.id === workoutId);
    return w?.name || "Workout";
  }
  const w = await prisma.workout.findUnique({
    where: { id: workoutId },
    select: { name: true },
  });
  return w?.name || "Workout";
}

export { TEMPLATE_CATEGORIES };
