import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { normalizeAccountEmail } from "@/lib/account-email";
import { resolveQuickAuthDeviceId } from "@/lib/quick-auth-device-cookie";
import { webAuthnRpId } from "@/lib/quick-auth-rp";
import { getDeviceQuickAuth } from "@/lib/quick-auth-store";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = normalizeAccountEmail(String(body.email || ""));
  const deviceId = await resolveQuickAuthDeviceId(body.deviceId);

  if (!email || !deviceId) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const entry = await getDeviceQuickAuth(email, deviceId);
  if (!entry?.webauthn?.credentialId) {
    return NextResponse.json({ error: "Biometrics not set up on this device." }, { status: 404 });
  }

  const options = await generateAuthenticationOptions({
    rpID: webAuthnRpId(),
    allowCredentials: [
      {
        id: entry.webauthn.credentialId,
        transports: entry.webauthn.transports as AuthenticatorTransport[] | undefined,
      },
    ],
    userVerification: "required",
  });

  const res = NextResponse.json(options);
  res.cookies.set("ts_wa_auth", options.challenge, {
    path: "/",
    maxAge: 5 * 60,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return res;
}