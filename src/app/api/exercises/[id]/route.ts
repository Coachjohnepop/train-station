import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  isDemoMode,
  hydrateDemoExercises,
  loadDemoExercises,
  saveDemoExercises,
} from "@/lib/demo-exercises";
import {
  demoPersistenceError,
  demoPersistenceWarning,
} from "@/lib/demo-persistence";
import { requireStaff } from "@/lib/api-auth";
import { storedDemoVideoUrl } from "@/lib/youtube";
import {
  archiveCatalogExercise,
  deleteOrArchiveCatalogExercise,
  restoreCatalogExercise,
} from "@/lib/catalog-exercise-archive";

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  videoUrl: z.string().max(2000).optional().nullable(),
  tags: z.string().optional().nullable(),
  /** Soft-restore from archive shelf. */
  action: z.literal("restore").optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  if (isDemoMode()) {
    await hydrateDemoExercises({ preferFresh: true });
    const exercise = loadDemoExercises().find((e: { id: string }) => e.id === id);
    if (!exercise) {
      return NextResponse.json({ detail: "Exercise not found" }, { status: 404 });
    }
    return NextResponse.json(exercise, { headers: { "Cache-Control": "no-store" } });
  }

  const exercise = await prisma.exercise.findUnique({ where: { id } });
  if (!exercise) {
    return NextResponse.json({ detail: "Exercise not found" }, { status: 404 });
  }
  return NextResponse.json(exercise, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  // Restore from archive shelf (same contract as workout templates).
  if (body?.action === "restore") {
    try {
      const row = await restoreCatalogExercise(id);
      return NextResponse.json(row);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Restore failed";
      if (msg === "NOT_FOUND") {
        return NextResponse.json({ detail: "Exercise not found" }, { status: 404 });
      }
      console.error("exercise.restore failed:", e);
      return NextResponse.json(
        { detail: msg.includes("could not be saved") ? msg : "Could not restore exercise." },
        { status: msg.includes("could not be saved") ? 503 : 500 },
      );
    }
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  const data: {
    name?: string;
    description?: string | null;
    videoUrl?: string | null;
    tags?: string | null;
  } = {};

  if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
  if (parsed.data.description !== undefined) {
    data.description = parsed.data.description?.trim() || null;
  }
  if (parsed.data.videoUrl !== undefined) {
    data.videoUrl = storedDemoVideoUrl(parsed.data.videoUrl);
  }
  if (parsed.data.tags !== undefined) {
    data.tags = parsed.data.tags?.trim() || null;
  }

  if (isDemoMode()) {
    await hydrateDemoExercises({ preferFresh: true });
    const list = loadDemoExercises();
    const idx = list.findIndex((e: { id: string }) => e.id === id);
    if (idx === -1) {
      return NextResponse.json(
        { detail: "Exercise not found — refresh the page and try again." },
        { status: 404 },
      );
    }
    const ex = { ...list[idx] };
    if (data.name !== undefined) ex.name = data.name;
    if (data.description !== undefined) ex.description = data.description;
    if (data.videoUrl !== undefined) ex.videoUrl = data.videoUrl;
    if (data.tags !== undefined) ex.tags = data.tags;
    ex.updatedAt = new Date().toISOString();
    list[idx] = ex;
    const saveResult = await saveDemoExercises(list);
    const persistenceFailure = demoPersistenceError(saveResult, "Exercise update");
    if (persistenceFailure) return persistenceFailure;

    const warning = demoPersistenceWarning(saveResult);
    return NextResponse.json(warning ? { ...ex, _persistenceWarning: warning } : ex);
  }

  try {
    const exercise = await prisma.exercise.update({
      where: { id },
      data,
    });
    return NextResponse.json(exercise);
  } catch {
    return NextResponse.json({ detail: "Exercise not found" }, { status: 404 });
  }
}

/**
 * DELETE = soft-archive by default (hide from pickers; keep workout refs).
 * ?hard=1 = permanent delete only if already archived (or force=1).
 */
export async function DELETE(request: Request, { params }: Params) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const url = new URL(request.url);
  const hard = url.searchParams.get("hard") === "1";
  const forceHard = url.searchParams.get("force") === "1";

  try {
    if (!hard) {
      // Prefer dedicated archive path so response includes the row.
      const exercise = await archiveCatalogExercise(id);
      return NextResponse.json({ ok: true, mode: "archived", exercise });
    }

    const result = await deleteOrArchiveCatalogExercise(id, {
      hard: true,
      forceHard,
    });
    return NextResponse.json({
      ok: true,
      mode: result.mode,
      removedFromWorkouts: result.removedFromWorkouts ?? 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Delete failed";
    if (msg === "NOT_FOUND") {
      return NextResponse.json({ detail: "Exercise not found" }, { status: 404 });
    }
    if (msg === "NOT_ARCHIVED") {
      return NextResponse.json(
        {
          detail:
            "Archive the exercise first, then permanently delete from the archive shelf.",
        },
        { status: 409 },
      );
    }
    if (msg.includes("could not be saved")) {
      return NextResponse.json({ detail: msg }, { status: 503 });
    }
    console.error("exercise.delete failed:", err);
    return NextResponse.json(
      { detail: "Could not delete exercise — try again." },
      { status: 500 },
    );
  }
}
