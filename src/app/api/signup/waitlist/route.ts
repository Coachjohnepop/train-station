import { NextResponse } from "next/server";
import { z } from "zod";
import { isInvitedAccountEmail } from "@/lib/invited-accounts";
import { addToWaitlist } from "@/lib/waitlist";

const schema = z.object({
  name: z.string().max(80).optional(),
  email: z.string().email(),
  plan: z.string().max(40).optional(),
  source: z.string().max(80).optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
  }

  const { name, email, plan, source } = parsed.data;
  const normalized = email.trim().toLowerCase();

  if (isInvitedAccountEmail(normalized)) {
    return NextResponse.json({
      invited: true,
      redirectTo: `/login?email=${encodeURIComponent(normalized)}`,
      message: "You already have access — sign in to continue.",
    });
  }

  const entry = addToWaitlist({ email: normalized, name, plan, source });

  const params = new URLSearchParams({
    email: entry.email,
    name: entry.name,
  });

  return NextResponse.json({
    success: true,
    redirectTo: `/coming-soon?${params.toString()}`,
  });
}