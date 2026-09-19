import { NextResponse } from "next/server";
import { z } from "zod";
import { generateSignupPassword } from "@/lib/signup-password";
import { completeMemberSignup } from "@/lib/complete-member-signup";
import { addToWaitlist } from "@/lib/waitlist";
import { notifyNewLead } from "@/lib/lead-notify";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
  phone: z.string().max(30).optional(),
  name: z.string().max(80).optional(),
});

/** Free measurements promo: email required, phone optional → explorer session. */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }
  const email = parsed.data.email.trim().toLowerCase();
  const phone = parsed.data.phone?.trim() || undefined;
  const rawName = parsed.data.name?.trim() || "";
  const parts = rawName.split(/\s+/).filter(Boolean);
  const firstName = parts[0] || email.split("@")[0] || "Guest";
  const lastName = parts.slice(1).join(" ") || "Check-in";

  await addToWaitlist({
    email,
    firstName,
    lastName,
    phone: phone || null,
    plan: "explorer",
    source: "measurements-promo",
  });
  await notifyNewLead({
    email,
    name: [firstName, lastName].join(" "),
    phone: phone || null,
    plan: "explorer",
    source: "measurements-promo",
    createdAt: new Date().toISOString(),
  });

  const password = generateSignupPassword();
  const res = await completeMemberSignup({
    email,
    firstName,
    lastName,
    phone,
    plan: "explorer",
    password,
    channel: "main",
  });

  if (res.status === 409) {
    return NextResponse.json({
      exists: true,
      redirectTo: `/login?email=${encodeURIComponent(email)}&redirect=${encodeURIComponent("/member/measurements/enter")}`,
      message: "You already have an account — sign in to save on your sheet.",
    });
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return NextResponse.json(
      { error: (body as { error?: string }).error || "Could not start check-in." },
      { status: res.status },
    );
  }

  const body = (await res.json()) as { user?: unknown };
  const out = NextResponse.json({
    ok: true,
    redirectTo: "/member/measurements/enter",
    user: body.user,
  });
  const setCookie = res.headers.getSetCookie?.() || [];
  for (const line of setCookie) {
    out.headers.append("set-cookie", line);
  }
  return out;
}
