import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { notifyCoachNewSignup } from "@/lib/coach-member-notify";
import { updateMemberProfile } from "@/lib/member-profiles-store";
import {
  createSpeakingInquiry,
  formatSpeakingInquirySummary,
} from "@/lib/speaking-inquiry";
import { notifyNewLead } from "@/lib/lead-notify";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  eventType: z.string().min(1).max(40),
  format: z.string().min(1).max(40),
  audienceSize: z.string().max(40).optional().nullable(),
  audienceDesc: z.string().max(2000).optional().nullable(),
  organization: z.string().max(200).optional().nullable(),
  eventDate: z.string().max(40).optional().nullable(),
  locationCity: z.string().max(100).optional().nullable(),
  locationState: z.string().max(40).optional().nullable(),
  budgetRange: z.string().max(40).optional().nullable(),
  topicsGoals: z.string().max(4000).optional().nullable(),
  extraNotes: z.string().max(4000).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  name: z.string().max(120).optional().nullable(),
});

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session?.email) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please complete the required intake fields." },
      { status: 400 },
    );
  }

  const data = parsed.data;
  try {
    const inquiry = await createSpeakingInquiry({
      userId: session.id,
      email: session.email,
      name: data.name || session.name || null,
      phone: data.phone || null,
      eventType: data.eventType,
      format: data.format,
      audienceSize: data.audienceSize,
      audienceDesc: data.audienceDesc,
      organization: data.organization,
      eventDate: data.eventDate,
      locationCity: data.locationCity,
      locationState: data.locationState,
      budgetRange: data.budgetRange,
      topicsGoals: data.topicsGoals,
      extraNotes: data.extraNotes,
    });

    const summary = formatSpeakingInquirySummary(inquiry);

    // Stamp profile so coach sees speaking intent in Members.
    if (session.id.startsWith("member-") || session.role === "MEMBER") {
      await updateMemberProfile(session.id, {
        plan: "speaking_fee",
        phone: data.phone || undefined,
        paymentNote: `Speaking intake submitted · ${summary}`,
        notes: [
          "Speaking engagement inquiry",
          summary,
          data.extraNotes ? `Notes: ${data.extraNotes}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      }).catch(() => null);
    }

    await notifyNewLead({
      email: session.email,
      name: inquiry.name || session.name || session.email,
      phone: data.phone || null,
      plan: "speaking_fee",
      source: "speaking-intake",
      createdAt: inquiry.createdAt,
    }).catch(() => null);

    await notifyCoachNewSignup({
      userId: session.id,
      name: inquiry.name || session.name || session.email,
      email: session.email,
      plan: "Speaking Engagements",
      phone: data.phone || null,
      source: `speaking-intake: ${summary.slice(0, 180)}`,
    }).catch(() => null);

    return NextResponse.json({
      ok: true,
      inquiryId: inquiry.id,
      /** Same 15-min booking surface as new members, with speaking context. */
      redirectTo: `/member/book?purpose=speaking&inquiry=${encodeURIComponent(inquiry.id)}`,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not save intake.";
    console.error("[speaking/intake]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
