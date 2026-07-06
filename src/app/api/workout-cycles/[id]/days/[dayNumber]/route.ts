import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/api-auth";
import { updateCycleDaySlot } from "@/lib/workout-cycle-db";

const patchSchema = z.object({
  trainingLocation: z.enum(["gym", "home"]).optional(),
  workoutId: z.string().nullable().optional(),
  isDayOff: z.boolean().optional(),
  notes: z.string().nullable().optional(),
  removeLocation: z.enum(["gym", "home"]).optional(),
});

type Params = { params: Promise<{ id: string; dayNumber: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const { id, dayNumber: dayStr } = await params;
  const dayNumber = Number(dayStr);
  if (!Number.isFinite(dayNumber) || dayNumber < 1 || dayNumber > 28) {
    return NextResponse.json({ detail: "dayNumber must be 1–28" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  try {
    if (parsed.data.removeLocation) {
      const { prisma } = await import("@/lib/prisma");
      const day = await prisma.workoutCycleDay.findUnique({
        where: { cycleId_dayNumber: { cycleId: id, dayNumber } },
      });
      if (day) {
        const slot = await prisma.workoutCycleDaySlot.findUnique({
          where: {
            cycleDayId_trainingLocation: {
              cycleDayId: day.id,
              trainingLocation: parsed.data.removeLocation,
            },
          },
        });
        if (slot) {
          await prisma.workoutCycleDaySlot.delete({ where: { id: slot.id } });
          const workoutId = parsed.data.workoutId || slot.workoutId;
          if (workoutId) {
            await prisma.$transaction(async (tx) => {
              await tx.programDayOption.deleteMany({ where: { workoutId } });
              await tx.programDay.updateMany({
                where: { workoutId },
                data: { workoutId: null },
              });
              await tx.workoutLog.deleteMany({ where: { workoutId } });
              await tx.workout.delete({ where: { id: workoutId } }).catch(() => null);
            });
          }
        }
      }
      const { getWorkoutCycleById, syncCycleToProgramSchedule } = await import(
        "@/lib/workout-cycle-db"
      );
      const cycle = await prisma.workoutCycle.findUnique({
        where: { id },
        select: { programId: true, cycleMonth: true },
      });
      if (cycle?.programId && cycle.cycleMonth) {
        await syncCycleToProgramSchedule(id);
      }
      const refreshed = await getWorkoutCycleById(id);
      return NextResponse.json(refreshed);
    }

    if (parsed.data.isDayOff) {
      const cycle = await updateCycleDaySlot(id, dayNumber, {
        trainingLocation: "gym",
        isDayOff: true,
        notes: parsed.data.notes,
      });
      return NextResponse.json(cycle);
    }

    if (!parsed.data.trainingLocation || !parsed.data.workoutId) {
      return NextResponse.json({ detail: "trainingLocation and workoutId required" }, { status: 400 });
    }

    const cycle = await updateCycleDaySlot(id, dayNumber, {
      trainingLocation: parsed.data.trainingLocation,
      workoutId: parsed.data.workoutId,
      notes: parsed.data.notes,
    });
    return NextResponse.json(cycle);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ detail: msg }, { status: 500 });
  }
}