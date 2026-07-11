import { NextResponse } from "next/server";
import { z } from "zod";
import { isCoachCatalogDemo } from "@/lib/catalog-mode";
import { DAY_OFF_LABEL, trainingLocationFromLabel } from "@/lib/program-calendar";
import { assignWorkoutToDay } from "@/lib/program-schedule";
import { prisma } from "@/lib/prisma";
import { getDemoSeed, mutateDemoSeed } from "@/lib/demo-seed-store";
import { BLOB_TOKEN } from "@/lib/demo-json-blob";
import { requireBlobPersisted } from "@/lib/demo-persistence";
import { ensureDemoWorkoutInSeed } from "@/lib/demo-workout-items";
import { requireCoachStaff } from "@/lib/api-auth";

const patchSchema = z.object({
  workoutId: z.string().nullable().optional(),
  videoUrl: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  calendarDate: z.string().nullable().optional(),
  defaultSets: z.number().int().min(1).max(20).optional(),
  defaultReps: z.string().max(40).optional(),
  defaultRestSec: z.number().int().min(0).max(600).optional(),
  publishedAt: z.string().nullable().optional(),
  options: z
    .array(
      z.object({
        workoutId: z.string(),
        label: z.string(),
        trainingLocation: z.enum(["gym", "home"]).optional().nullable(),
        notes: z.string().nullable().optional(),
      }),
    )
    .optional(),
});

type Params = { params: Promise<{ dayId: string }> };

function resolveDayResponse(data: Record<string, unknown>, dayId: string) {
  const day = (data.programDays as any[] | undefined)?.find((d) => d.id === dayId);
  if (!day) return null;

  const workoutsById: Record<string, any> = Object.fromEntries(
    ((data.workouts as any[]) || []).map((w) => [w.id, w]),
  );

  const options = ((data.programDayOptions as any[]) || [])
    .filter((o) => o.dayId === dayId)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((o) => ({
      workoutId: o.workoutId,
      label: o.label,
      trainingLocation: o.trainingLocation ?? null,
      notes: o.notes ?? null,
      workout: workoutsById[o.workoutId] || null,
    }));

  return {
    ...day,
    workout: day.workoutId ? workoutsById[day.workoutId] || null : null,
    options:
      options.length > 0
        ? options
        : day.workoutId
          ? [{ workoutId: day.workoutId, label: "Standard", workout: workoutsById[day.workoutId] || null }]
          : [],
  };
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const { dayId } = await params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  if (isCoachCatalogDemo()) {
    let notFound = false;
    let expectedWorkoutIds: string[] = [];
    const { blobSaved, data: persistedData } = await mutateDemoSeed((data) => {
      const days = (data.programDays as any[]) || [];
      const dayIdx = days.findIndex((d) => d.id === dayId);
      if (dayIdx === -1) {
        notFound = true;
        return;
      }

      const day = { ...days[dayIdx] };
      let workouts = (data.workouts as any[]) || [];

      if (parsed.data.options !== undefined) {
        expectedWorkoutIds = parsed.data.options.map((opt) => opt.workoutId);
        if (!data.programDayOptions) data.programDayOptions = [];
        data.programDayOptions = (data.programDayOptions as any[]).filter(
          (o) => o.dayId !== dayId,
        );
        parsed.data.options.forEach((opt, idx) => {
          workouts = ensureDemoWorkoutInSeed(
            workouts,
            opt.workoutId,
            opt.label || "Workout",
          );
          (data.programDayOptions as any[]).push({
            id: `pdo-${dayId}-${idx}-${Date.now()}`,
            dayId,
            workoutId: opt.workoutId,
            label: opt.label,
            trainingLocation: opt.trainingLocation ?? trainingLocationFromLabel(opt.label),
            notes: opt.notes ?? null,
            sortOrder: idx,
          });
        });
        if (notFound) return;

        if (parsed.data.options.length > 0) {
          day.workoutId = parsed.data.options[0].workoutId;
        } else {
          day.workoutId = null;
        }
        data.workouts = workouts;
      } else if (parsed.data.workoutId !== undefined) {
        if (parsed.data.workoutId) {
          data.workouts = ensureDemoWorkoutInSeed(workouts, parsed.data.workoutId);
          day.workoutId = parsed.data.workoutId;
          if (!data.programDayOptions) data.programDayOptions = [];
          data.programDayOptions = (data.programDayOptions as any[]).filter(
            (o) => o.dayId !== dayId,
          );
          (data.programDayOptions as any[]).push({
            id: `pdo-${dayId}-0-${Date.now()}`,
            dayId,
            workoutId: parsed.data.workoutId,
            label: "Standard",
            sortOrder: 0,
          });
        } else {
          day.workoutId = null;
          if (data.programDayOptions) {
            data.programDayOptions = (data.programDayOptions as any[]).filter(
              (o) => o.dayId !== dayId,
            );
          }
        }
      }

      if (parsed.data.videoUrl !== undefined) day.videoUrl = parsed.data.videoUrl;
      if (parsed.data.notes !== undefined) day.notes = parsed.data.notes;
      if (parsed.data.calendarDate !== undefined) day.calendarDate = parsed.data.calendarDate;
      if (parsed.data.defaultSets !== undefined) day.defaultSets = parsed.data.defaultSets;
      if (parsed.data.defaultReps !== undefined) day.defaultReps = parsed.data.defaultReps;
      if (parsed.data.defaultRestSec !== undefined) day.defaultRestSec = parsed.data.defaultRestSec;
      if (parsed.data.publishedAt !== undefined) day.publishedAt = parsed.data.publishedAt;

      days[dayIdx] = day;
      data.programDays = days;
    }, { preferFresh: true });

    if (notFound) {
      return NextResponse.json({ detail: "Day or workout not found" }, { status: 404 });
    }
    try {
      requireBlobPersisted(blobSaved, "Program day update");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Program day update failed";
      return NextResponse.json({ detail: msg }, { status: 503 });
    }

    const verifyFromSeed = (seed: Record<string, unknown>) => {
      const day = ((seed.programDays as any[]) || []).find((d) => d.id === dayId);
      const optionIds = ((seed.programDayOptions as any[]) || [])
        .filter((o) => o.dayId === dayId)
        .map((o) => o.workoutId);
      return (
        day?.workoutId === expectedWorkoutIds[0] &&
        expectedWorkoutIds.every((id) => optionIds.includes(id))
      );
    };

    let responseSeed: Record<string, unknown> = persistedData as Record<string, unknown>;
    if (expectedWorkoutIds.length > 0 && !verifyFromSeed(responseSeed)) {
      let verified = false;
      for (let attempt = 0; attempt < 8; attempt++) {
        const seed = await getDemoSeed({ preferFresh: true });
        if (verifyFromSeed(seed as Record<string, unknown>)) {
          responseSeed = seed as Record<string, unknown>;
          verified = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
      }
      if (!verified) {
        return NextResponse.json(
          { detail: "Day updated but cloud save failed — retry in a moment." },
          { status: 503 },
        );
      }
    }

    const data = responseSeed;
    const response = resolveDayResponse(data, dayId);
    if (!response) {
      return NextResponse.json({ detail: "Day not found" }, { status: 404 });
    }
    return NextResponse.json(response);
  }

  try {
    if (parsed.data.options !== undefined) {
      const materialized = parsed.data.options.filter((opt) => opt.workoutId?.trim());
      const restOnly =
        parsed.data.options.length > 0 &&
        materialized.length === 0 &&
        parsed.data.options.every(
          (opt) => !opt.workoutId?.trim() && /^day\s*off$/i.test(opt.label?.trim() || ""),
        );

      for (const opt of materialized) {
        const workout = await prisma.workout.findUnique({ where: { id: opt.workoutId } });
        if (!workout) {
          return NextResponse.json({ detail: "Workout not found" }, { status: 404 });
        }
      }

      const day = await prisma.$transaction(async (tx) => {
        await tx.programDayOption.deleteMany({ where: { dayId } });
        if (materialized.length > 0) {
          await tx.programDayOption.createMany({
            data: materialized.map((opt, idx) => ({
              dayId,
              workoutId: opt.workoutId,
              label: opt.label,
              trainingLocation:
                opt.trainingLocation ?? trainingLocationFromLabel(opt.label),
              notes: opt.notes ?? null,
              sortOrder: idx,
            })),
          });
        }

        return tx.programDay.update({
          where: { id: dayId },
          data: {
            workoutId: materialized.length > 0 ? materialized[0].workoutId : null,
            ...(restOnly ? { notes: DAY_OFF_LABEL } : {}),
            ...(parsed.data.videoUrl !== undefined ? { videoUrl: parsed.data.videoUrl } : {}),
            ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
            ...(parsed.data.calendarDate !== undefined
              ? { calendarDate: parsed.data.calendarDate }
              : {}),
            ...(parsed.data.defaultSets !== undefined
              ? { defaultSets: parsed.data.defaultSets }
              : {}),
            ...(parsed.data.defaultReps !== undefined
              ? { defaultReps: parsed.data.defaultReps }
              : {}),
            ...(parsed.data.defaultRestSec !== undefined
              ? { defaultRestSec: parsed.data.defaultRestSec }
              : {}),
            ...(parsed.data.publishedAt !== undefined
              ? {
                  publishedAt: parsed.data.publishedAt
                    ? new Date(parsed.data.publishedAt)
                    : null,
                }
              : {}),
          },
          include: {
            workout: true,
            options: {
              orderBy: { sortOrder: "asc" },
              include: { workout: true },
            },
          },
        });
      });

      return NextResponse.json({
        ...day,
        options: day.options.map((opt) => ({
          workoutId: opt.workoutId,
          label: opt.label,
          trainingLocation: opt.trainingLocation ?? null,
          notes: opt.notes ?? null,
          workout: opt.workout,
        })),
      });
    }

    const dataUpdate: Record<string, unknown> = {};
    if (parsed.data.workoutId !== undefined) {
      if (parsed.data.workoutId) {
        const workout = await prisma.workout.findUnique({ where: { id: parsed.data.workoutId } });
        if (!workout) {
          return NextResponse.json({ detail: "Workout not found" }, { status: 404 });
        }
      }
      dataUpdate.workoutId = parsed.data.workoutId;
    }
    if (parsed.data.videoUrl !== undefined) dataUpdate.videoUrl = parsed.data.videoUrl;
    if (parsed.data.notes !== undefined) dataUpdate.notes = parsed.data.notes;
    if (parsed.data.calendarDate !== undefined) dataUpdate.calendarDate = parsed.data.calendarDate;
    if (parsed.data.defaultSets !== undefined) dataUpdate.defaultSets = parsed.data.defaultSets;
    if (parsed.data.defaultReps !== undefined) dataUpdate.defaultReps = parsed.data.defaultReps;
    if (parsed.data.defaultRestSec !== undefined) {
      dataUpdate.defaultRestSec = parsed.data.defaultRestSec;
    }
    if (parsed.data.publishedAt !== undefined) {
      dataUpdate.publishedAt = parsed.data.publishedAt
        ? new Date(parsed.data.publishedAt)
        : null;
    }

    if (Object.keys(dataUpdate).length > 0) {
      const day = await prisma.programDay.update({
        where: { id: dayId },
        data: dataUpdate,
        include: {
          workout: true,
          options: { orderBy: { sortOrder: "asc" }, include: { workout: true } },
        },
      });
      return NextResponse.json({
        ...day,
        options: day.options.map((opt) => ({
          workoutId: opt.workoutId,
          label: opt.label,
          trainingLocation: opt.trainingLocation ?? null,
          notes: opt.notes ?? null,
          workout: opt.workout,
        })),
      });
    }

    const day = await assignWorkoutToDay(dayId, parsed.data.workoutId ?? null);
    return NextResponse.json(day);
  } catch {
    return NextResponse.json({ detail: "Day not found or update failed" }, { status: 404 });
  }
}