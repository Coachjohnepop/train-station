import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isStaffRole } from "@/lib/auth";

export const dynamic = "force-dynamic";
import { getLandingMedia, saveLandingMedia } from "@/lib/landing-media-store";
import {
  freeChastiseVideoUrlFromConfig,
  welcomeVideoUrlFromConfig,
} from "@/lib/landing-media";

const patchSchema = z.object({
  welcomeVideoUrl: z.string().max(500).nullable().optional(),
  freeChastiseVideoUrl: z.string().max(500).nullable().optional(),
  venmoQrUrl: z.string().max(500).nullable().optional(),
  venmoHandle: z.string().max(80).nullable().optional(),
  venmoInstructions: z.string().max(500).nullable().optional(),
});

function formatResponse(config: Awaited<ReturnType<typeof getLandingMedia>>) {
  return {
    welcomeVideoUrl: welcomeVideoUrlFromConfig(config.welcomeVideoUrl),
    freeChastiseVideoUrl: freeChastiseVideoUrlFromConfig(config.freeChastiseVideoUrl),
    storedWelcomeVideoUrl: config.welcomeVideoUrl,
    storedFreeChastiseVideoUrl: config.freeChastiseVideoUrl,
    venmoQrUrl: config.venmoQrUrl,
    venmoHandle: config.venmoHandle,
    venmoInstructions: config.venmoInstructions,
    hasVenmoQr: Boolean(config.venmoQrUrl?.trim()),
    updatedAt: config.updatedAt,
    hasWelcome: Boolean(welcomeVideoUrlFromConfig(config.welcomeVideoUrl)),
    hasFreeChastise: Boolean(freeChastiseVideoUrlFromConfig(config.freeChastiseVideoUrl)),
  };
}

async function requireStaff() {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) return null;
  return session;
}

export async function GET() {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Coach sign-in required." }, { status: 401 });
  }
  const config = await getLandingMedia();
  return NextResponse.json(formatResponse(config));
}

export async function PATCH(request: Request) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Coach sign-in required." }, { status: 401 });
  }

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const config = await saveLandingMedia(parsed.data);
    return NextResponse.json(formatResponse(config));
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}