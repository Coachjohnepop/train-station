import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformStaff } from "@/lib/api-auth";
import { getStripeReservePosition, setAffiliateReserveTarget } from "@/lib/affiliate/reserve";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;
  return NextResponse.json(await getStripeReservePosition());
}

const patchSchema = z.object({ reserveTargetCents: z.number().int().min(0).max(5_000_000) });

export async function PATCH(request: Request) {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;
  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Enter a reserve in cents." }, { status: 400 });
  await setAffiliateReserveTarget(parsed.data.reserveTargetCents);
  return NextResponse.json(await getStripeReservePosition());
}
