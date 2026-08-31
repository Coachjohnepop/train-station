import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  isDemoMode,
  hydrateDemoExercises,
  loadDemoExercises,
  saveDemoExercises,
  createDemoExerciseId,
} from "@/lib/demo-exercises";
import {
  demoPersistenceError,
  demoPersistenceWarning,
} from "@/lib/demo-persistence";
import { requireStaff } from "@/lib/api-auth";
import { hintVideoUrlForExerciseName } from "@/lib/exercise-video-hints";
import { storedDemoVideoUrl } from "@/lib/youtube";
import {
  listCatalogExercises,
  type ArchiveFilter,
} from "@/lib/catalog-exercise-archive";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  videoUrl: z.string().max(2000).optional(),
  tags: z.string().optional(),
});

/** GET ?archive=active|archived|all — default active (pickers hide archived). */
export async function GET(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const archiveParam = url.searchParams.get("archive");
  const archive: ArchiveFilter =
    archiveParam === "archived" ||
    archiveParam === "all" ||
    archiveParam === "active"
      ? archiveParam
      : "active";

  try {
    const exercises = await listCatalogExercises(archive);
    return NextResponse.json(exercises, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("GET /api/exercises", err);
    return NextResponse.json(
      { detail: "Could not load exercises." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }
  const { name, description, videoUrl, tags } = parsed.data;
  const resolvedVideoUrl =
    storedDemoVideoUrl(videoUrl) || hintVideoUrlForExerciseName(name.trim()) || null;

  if (isDemoMode()) {
    await hydrateDemoExercises({ preferFresh: true });
    const list = loadDemoExercises();
    const exercise = {
      id: createDemoExerciseId(),
      name: name.trim(),
      description: description?.trim() || null,
      videoUrl: resolvedVideoUrl,
      tags: tags?.trim() || null,
      archivedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      defaultSetScheme: null,
      defaultSets: null,
      defaultWeightTier: null,
    };
    list.push(exercise);
    const saveResult = await saveDemoExercises(list);
    const persistenceFailure = demoPersistenceError(saveResult, "Exercise create");
    if (persistenceFailure) return persistenceFailure;

    const warning = demoPersistenceWarning(saveResult);
    return NextResponse.json(
      warning ? { ...exercise, _persistenceWarning: warning } : exercise,
      { status: 201 },
    );
  }

  try {
    const exercise = await prisma.exercise.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        videoUrl: resolvedVideoUrl,
        tags: tags?.trim() || null,
      },
    });
    return NextResponse.json(exercise, { status: 201 });
  } catch (err) {
    console.error("POST /api/exercises", err);
    return NextResponse.json(
      {
        detail:
          "Database error saving exercise. Check DATABASE_URL in .env (or paste your real Supabase connection strings).",
      },
      { status: 500 },
    );
  }
}
