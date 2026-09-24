import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAffiliateClick } from "@/lib/affiliate/tracking";

export const dynamic = "force-dynamic";

const schema = z.object({
  ref: z.string().min(1).max(32),
  visitorId: z.string().min(4).max(80),
  landingPage: z.string().max(300).optional(),
  referer: z.string().max(500).nullable().optional(),
  userAgent: z.string().max(500).nullable().optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false });
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const result = await recordAffiliateClick({
    ref: parsed.data.ref,
    visitorId: parsed.data.visitorId,
    landingPage: parsed.data.landingPage || "/",
    referer: parsed.data.referer,
    userAgent: parsed.data.userAgent,
    ipAddress: forwarded,
  });
  return NextResponse.json(result);
}
