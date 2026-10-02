import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { sendLeadJoinLinkEmail } from "@/lib/lead-notify";
import { listLeads, setLeadLane } from "@/lib/waitlist";
import { LEAD_LANES } from "@/lib/waitlist-lane";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().email(),
  lane: z.enum(LEAD_LANES),
});

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
  const leads = await listLeads();
  return NextResponse.json({ leads });
}

export async function POST(request: Request) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Coach sign-in required." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  const lead = await setLeadLane(parsed.data.email, parsed.data.lane);
  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  let emailSent: boolean | null = null;
  if (parsed.data.lane === "convert") {
    emailSent = await sendLeadJoinLinkEmail({ email: lead.email, name: lead.name });
  }

  return NextResponse.json({ ok: true, lead, emailSent });
}
