import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { getSessionUser } from "@/lib/auth";
import { resolveQuickAuthDeviceId } from "@/lib/quick-auth-device-cookie";
import { webAuthnOrigin, webAuthnRpId, webAuthnRpName } from "@/lib/quick-auth-rp";

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const deviceId = await resolveQuickAuthDeviceId(body.deviceId);
  if (!deviceId) {
    return NextResponse.json({ error: "Invalid device." }, { status: 400 });
  }

  const options = await generateRegistrationOptions({
    rpName: webAuthnRpName(),
    rpID: webAuthnRpId(),
    userName: session.email,
    userDisplayName: session.name,
    userID: Buffer.from(`${session.id}:${deviceId}`, "utf8"),
    attestationType: "none",
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      residentKey: "discouraged",
      userVerification: "required",
    },
  });

  const res = NextResponse.json(options);
  res.cookies.set("ts_wa_reg", options.challenge, {
    path: "/",
    maxAge: 5 * 60,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return res;
}