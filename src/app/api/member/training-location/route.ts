import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveMemberUserId } from "@/lib/current-user";
import { setUserTrainingLocation } from "@/lib/data/user-data";

const patchSchema = z.object({
  programSlug: z.string().min(1),
  trainingLocation: z.enum(["gym", "home"]),
});

export async function PATCH(request: Request) {
  const userId = await resolveMemberUserId();
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await setUserTrainingLocation(
      userId,
      parsed.data.programSlug,
      parsed.data.trainingLocation,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Update failed";
    if (message === "Not enrolled in program") {
      return NextResponse.json({ detail: message }, { status: 404 });
    }
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}