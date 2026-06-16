import { NextResponse } from "next/server";
import { z } from "zod";
import { isInvitedAccountEmail } from "@/lib/invited-accounts";
import { addToWaitlist } from "@/lib/waitlist";
import { notifyNewLead } from "@/lib/lead-notify";

const schema = z.object({
  email: z.string().email(),
  firstName: z.string().max(60).optional(),
  lastName: z.string().max(60).optional(),
  phone: z.string().max(30).optional(),
  // Accepted for backward compatibility (older clients sent a single name).
  name: z.string().max(120).optional(),
  plan: z.string().max(40).optional(),
  source: z.string().max(80).optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
  }

  const { email, firstName, lastName, phone, name, plan, source } = parsed.data;
  const normalized = email.trim().toLowerCase();

  // Split a legacy single name into first/last if first/last weren't sent.
  let first = firstName;
  let last = lastName;
  if (!first && !last && name) {
    const parts = name.trim().split(/\s+/);
    first = parts.shift();
    last = parts.join(" ") || undefined;
  }

  if (isInvitedAccountEmail(normalized)) {
    return NextResponse.json({
      invited: true,
      redirectTo: `/login?email=${encodeURIComponent(normalized)}`,
      message: "You already have access — sign in to continue.",
    });
  }

  const entry = await addToWaitlist({
    email: normalized,
    firstName: first,
    lastName: last,
    phone,
    plan,
    source,
  });

  // Stopgap until durable DB storage is live: email the team so no lead is
  // lost even if the file-backed store resets. No-ops if Resend isn't configured.
  await notifyNewLead(entry);

  const params = new URLSearchParams({
    email: entry.email,
    name: entry.name,
  });

  return NextResponse.json({
    success: true,
    redirectTo: `/coming-soon?${params.toString()}`,
    _debug: {
      blobReserved: !!process.env.BLOB_READ_WRITE_TOKEN,
      tsBlob: !!process.env.TS_BLOB_TOKEN,
      dbDummy: (process.env.DATABASE_URL || "").includes("dummy"),
      hasDb: !!process.env.DATABASE_URL,
    },
  });
}