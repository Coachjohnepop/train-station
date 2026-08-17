import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/api-auth";
import { isCoachCatalogDemo } from "@/lib/catalog-mode";
import { mutateDemoSeed, getDemoSeed } from "@/lib/demo-seed-store";
import { BLOB_TOKEN } from "@/lib/demo-json-blob";
import { requireBlobPersisted } from "@/lib/demo-persistence";
import { prisma } from "@/lib/prisma";
import { isSmsWorkoutId } from "@/lib/sms-workout-builder-api";
import { DEFAULT_REST_TIMER_SECONDS, normalizeRestTimerSeconds } from "@/lib/rest-timer";
import {
  DEFAULT_REST_TIMER_SOUND,
  normalizeRestTimerSound,
} from "@/lib/rest-timer-sound";
import { updateWorkoutRestTimer } from "@/lib/sms-generated-workouts";

const bodySchema = z.object({
  enabled: z.boolean(),
  seconds: z.number().int().min(15).max(600).optional(),
  /** Built-in id or full custom audio URL */
  sound: z.string().min(1).max(2000).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const enabled = parsed.data.enabled;
  const seconds = normalizeRestTimerSeconds(parsed.data.seconds ?? DEFAULT_REST_TIMER_SECONDS);
  const sound = normalizeRestTimerSound(parsed.data.sound ?? DEFAULT_REST_TIMER_SOUND);

  if (isSmsWorkoutId(id)) {
    try {
      await updateWorkoutRestTimer(id, { enabled, seconds, sound });
      return NextResponse.json({
        ok: true,
        restTimerEnabled: enabled,
        restTimerSeconds: enabled ? seconds : null,
        restTimerSound: sound,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not save rest timer";
      return NextResponse.json({ error: msg }, { status: 503 });
    }
  }

  if (isCoachCatalogDemo()) {
    try {
      const { blobSaved } = await mutateDemoSeed((data) => {
        const workouts = (data.workouts || []) as Array<Record<string, unknown>>;
        const idx = workouts.findIndex((w) => w.id === id);
        if (idx === -1) return;
        workouts[idx] = {
          ...workouts[idx],
          restTimerEnabled: enabled,
          restTimerSeconds: enabled ? seconds : null,
          restTimerSound: sound,
          updatedAt: new Date().toISOString(),
        };
        data.workouts = workouts;
      });
      requireBlobPersisted(blobSaved, "Rest timer update");
      const seed = await getDemoSeed({ preferFresh: Boolean(BLOB_TOKEN) });
      const w = ((seed.workouts as Array<Record<string, unknown>>) || []).find((x) => x.id === id);
      if (!w) {
        return NextResponse.json({ error: "Workout not found" }, { status: 404 });
      }
      return NextResponse.json({
        ok: true,
        restTimerEnabled: Boolean(w.restTimerEnabled),
        restTimerSeconds: w.restTimerSeconds ?? null,
        restTimerSound: normalizeRestTimerSound(w.restTimerSound),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not save rest timer";
      return NextResponse.json({ error: msg }, { status: 503 });
    }
  }

  try {
    const updated = await prisma.workout.update({
      where: { id },
      data: {
        restTimerEnabled: enabled,
        restTimerSeconds: enabled ? seconds : null,
        restTimerSound: sound,
      },
      select: {
        id: true,
        restTimerEnabled: true,
        restTimerSeconds: true,
        restTimerSound: true,
      },
    });
    return NextResponse.json({
      ok: true,
      restTimerEnabled: updated.restTimerEnabled,
      restTimerSeconds: updated.restTimerSeconds,
      restTimerSound: normalizeRestTimerSound(updated.restTimerSound),
    });
  } catch {
    return NextResponse.json({ error: "Workout not found" }, { status: 404 });
  }
}
