import { NextResponse } from "next/server";
import { z } from "zod";
import { assignWorkoutToDay } from "@/lib/program-schedule";
import { prisma } from "@/lib/prisma";
import { getDemoSeed, mutateDemoSeed } from "@/lib/demo-seed-store";
import { BLOB_TOKEN } from "@/lib/demo-json-blob";
import { ensureDemoWorkoutInSeed } from "@/lib/demo-workout-items";

function isDemoMode() {
  const url = process.env.DATABASE_URL ?? "";
  return !url || url.includes("dummy.supabase") || url.includes("dummy");
}

const patchSchema = z.object({
  workoutId: z.string().nullable().optional(),
  videoUrl: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  options: z.array(z.object({ workoutId: z.string(), label: z.string() })).optional(),
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
  const { dayId } = await params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  if (isDemoMode()) {
    let notFound = false;
    const { blobSaved } = await mutateDemoSeed((data) => {
      const days = (data.programDays as any[]) || [];
      const dayIdx = days.findIndex((d) => d.id === dayId);
      if (dayIdx === -1) {
        notFound = true;
        return;
      }

      const day = { ...days[dayIdx] };
      let workouts = (data.workouts as any[]) || [];

      if (parsed.data.options !== undefined) {
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

      days[dayIdx] = day;
      data.programDays = days;
    });

    if (notFound) {
      return NextResponse.json({ detail: "Day or workout not found" }, { status: 404 });
    }
    if (process.env.VERCEL && BLOB_TOKEN && !blobSaved) {
      return NextResponse.json(
        { detail: "Day updated but cloud save failed — retry in a moment." },
        { status: 503 },
      );
    }

    const data = await getDemoSeed();
    const response = resolveDayResponse(data, dayId);
    if (!response) {
      return NextResponse.json({ detail: "Day not found" }, { status: 404 });
    }
    return NextResponse.json(response);
  }

  try {
    if (parsed.data.options !== undefined) {
      for (const opt of parsed.data.options) {
        const workout = await prisma.workout.findUnique({ where: { id: opt.workoutId } });
        if (!workout) {
          return NextResponse.json({ detail: "Workout not found" }, { status: 404 });
        }
      }

      const day = await prisma.$transaction(async (tx) => {
        await tx.programDayOption.deleteMany({ where: { dayId } });
        if (parsed.data.options!.length > 0) {
          await tx.programDayOption.createMany({
            data: parsed.data.options!.map((opt, idx) => ({
              dayId,
              workoutId: opt.workoutId,
              label: opt.label,
              sortOrder: idx,
            })),
          });
        }

        return tx.programDay.update({
          where: { id: dayId },
          data: {
            workoutId: parsed.data.options!.length > 0 ? parsed.data.options![0].workoutId : null,
            ...(parsed.data.videoUrl !== undefined ? { videoUrl: parsed.data.videoUrl } : {}),
            ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
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