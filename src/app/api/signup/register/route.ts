import { NextResponse } from "next/server";
import { z } from "zod";
import { completeMemberSignup } from "@/lib/complete-member-signup";
import { requireSignupPassword } from "@/lib/security-config";

/** Main + BYOW share completeMemberSignup — do not fork signup here. */
const schema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  phone: z.string().max(30).optional(),
  plan: z.string().max(40).optional(),
  password: z.string().max(128).optional(),
  referralCode: z.string().max(40).optional(),
  week: z.boolean().optional(),
  channel: z.enum(["main", "byow"]).optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please fill in email and name." }, { status: 400 });
  }

  const { email, firstName, lastName, phone, plan: rawPlan, password, referralCode, week, channel } =
    parsed.data;

  if (requireSignupPassword()) {
    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: "Choose a password with at least 8 characters." },
        { status: 400 },
      );
    }
  }

  return completeMemberSignup({
    email,
    firstName,
    lastName,
    phone,
    plan: rawPlan,
    password,
    referralCode,
    week,
    channel: channel === "byow" ? "byow" : "main",
  });
}
