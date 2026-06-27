import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/auth";
import { resolveQuickAuthDeviceId } from "@/lib/quick-auth-device-cookie";
import { webAuthnOrigin, webAuthnRpId } from "@/lib/quick-auth-rp";
import { getDeviceQuickAuth, upsertDeviceQuickAuth } from "@/lib/quick-auth-store";

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const cookieStore = await cookies();
  const expectedChallenge = cookieStore.get("ts_wa_reg")?.value;
  if (!expectedChallenge) {
    return NextResponse.json({ error: "Registration expired — try again." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const deviceId = await resolveQuickAuthDeviceId(body.deviceId);
  const attestation = body.attestation;
  if (!deviceId || !attestation) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: attestation,
      expectedChallenge,
      expectedOrigin: webAuthnOrigin(),
      expectedRPID: webAuthnRpId(),
      requireUserVerification: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "Could not verify biometrics." }, { status: 400 });
  }

  const { credential, credentialDeviceType } = verification.registrationInfo;
  const existing = (await getDeviceQuickAuth(session.email, deviceId)) ?? {
    email: session.email,
    deviceId,
    updatedAt: new Date().toISOString(),
  };

  const now = new Date().toISOString();
  await upsertDeviceQuickAuth({
    ...existing,
    email: session.email,
    deviceId,
    webauthn: {
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: credential.transports,
      createdAt: now,
    },
    updatedAt: now,
  });

  const res = NextResponse.json({
    ok: true,
    webauthn: true,
    deviceType: credentialDeviceType,
  });
  res.cookies.set("ts_wa_reg", "", { path: "/", maxAge: 0 });
  return res;
}