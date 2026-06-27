import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/api-auth";
import { isValidPin } from "@/lib/quick-auth-pin";
import {
  clearAdminPinForEmail,
  clearAllQuickAuthForEmail,
  clearWebAuthnForEmail,
  getQuickAuthAdminSummary,
  removeDeviceQuickAuth,
  setAdminPinForEmail,
} from "@/lib/quick-auth-store";
import { resolveUserEmailById } from "@/lib/resolve-user-email";

type RouteContext = { params: Promise<{ userId: string }> };

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("setPin"),
    pin: z.string(),
  }),
  z.object({ action: z.literal("clearPin") }),
  z.object({ action: z.literal("clearWebauthn") }),
  z.object({ action: z.literal("clearAll") }),
  z.object({
    action: z.literal("removeDevice"),
    deviceId: z.string(),
  }),
]);

export async function GET(_request: Request, context: RouteContext) {
  const staff = await requireStaff();
  if (!staff.ok) return staff.response;

  const { userId } = await context.params;
  const email = await resolveUserEmailById(userId);
  if (!email) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const summary = await getQuickAuthAdminSummary(email);
  return NextResponse.json({ email, ...summary });
}

export async function PATCH(request: Request, context: RouteContext) {
  const staff = await requireStaff();
  if (!staff.ok) return staff.response;

  const { userId } = await context.params;
  const email = await resolveUserEmailById(userId);
  if (!email) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const parsed = actionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const body = parsed.data;
  switch (body.action) {
    case "setPin":
      if (!isValidPin(body.pin)) {
        return NextResponse.json({ error: "PIN must be 4–6 digits." }, { status: 400 });
      }
      await setAdminPinForEmail(email, body.pin);
      break;
    case "clearPin":
      await clearAdminPinForEmail(email);
      break;
    case "clearWebauthn":
      await clearWebAuthnForEmail(email);
      break;
    case "clearAll":
      await clearAllQuickAuthForEmail(email);
      break;
    case "removeDevice":
      await removeDeviceQuickAuth(email, body.deviceId);
      break;
  }

  const summary = await getQuickAuthAdminSummary(email);
  return NextResponse.json({ ok: true, email, ...summary });
}