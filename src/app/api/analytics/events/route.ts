import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { ingestAnalyticsEvents } from "@/lib/analytics-store";
const eventSchema = z.object({
  eventType: z.string().min(1).max(64),
  occurredAt: z.string().datetime().optional(),
  pagePath: z.string().max(500).optional(),
  pageTitle: z.string().max(200).optional(),
  pageSection: z.string().max(32).optional(),
  referrer: z.string().max(500).optional(),
  elementId: z.string().max(120).optional(),
  elementText: z.string().max(240).optional(),
  elementRole: z.string().max(32).optional(),
  clickHref: z.string().max(500).optional(),
  clickAction: z.string().max(120).optional(),
  programId: z.string().max(64).optional(),
  programSlug: z.string().max(64).optional(),
  workoutId: z.string().max(64).optional(),
  exerciseId: z.string().max(64).optional(),
  enrollmentId: z.string().max(64).optional(),
  tierSlug: z.string().max(32).optional(),
  utmSource: z.string().max(120).optional(),
  utmMedium: z.string().max(120).optional(),
  utmCampaign: z.string().max(120).optional(),
  deviceType: z.string().max(16).optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
});

const ingestSchema = z.object({
  session: z.object({
    sessionKey: z.string().min(8).max(64),
    anonymousId: z.string().max(64).optional(),
    landingPath: z.string().max(500).optional(),
    referrer: z.string().max(500).optional(),
    utmSource: z.string().max(120).optional(),
    utmMedium: z.string().max(120).optional(),
    utmCampaign: z.string().max(120).optional(),
    utmTerm: z.string().max(120).optional(),
    utmContent: z.string().max(120).optional(),
    deviceType: z.string().max(16).optional(),
    userAgent: z.string().max(500).optional(),
  }),
  events: z.array(eventSchema).min(1).max(50),
});

export async function POST(request: Request) {
  const parsed = ingestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  const session = await getSessionUser();

  const result = await ingestAnalyticsEvents(parsed.data, {
    userId: session?.id ?? null,
    role: session?.role ?? null,
  });

  return NextResponse.json({
    ok: true,
    accepted: result.accepted,
    storage: result.storage,
  });
}