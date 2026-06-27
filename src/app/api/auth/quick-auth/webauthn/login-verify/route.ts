import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { cookies } from "next/headers";
import { normalizeAccountEmail } from "@/lib/account-email";
import { resolveUserByEmail } from "@/lib/auth";
import { buildLoginResponse } from "@/lib/complete-login";
import { isInvitedAccountEmail } from "@/lib/invited-accounts";
import { resolveQuickAuthDeviceId } from "@/lib/quick-auth-device-cookie";
import { webAuthnOriginFromRequest, webAuthnRpId } from "@/lib/quick-auth-rp";
import { getDeviceQuickAuth, upsertDeviceQuickAuth } from "@/lib/quick-auth-store";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const expectedChallenge = cookieStore.get("ts_wa_auth")?.value;
  if (!expectedChallenge) {
    return NextResponse.json({ error: "Sign-in expired — try again." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const email = normalizeAccountEmail(String(body.email || ""));
  const deviceId = await resolveQuickAuthDeviceId(body.deviceId);
  const assertion = body.assertion;
  const redirect = typeof body.redirect === "string" ? body.redirect : "";

  if (!email || !deviceId || !assertion) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!(await isInvitedAccountEmail(email))) {
    return NextResponse.json({ error: "No quick sign-in for this account." }, { status: 403 });
  }

  const entry = await getDeviceQuickAuth(email, deviceId);
  if (!entry?.webauthn) {
    return NextResponse.json({ error: "Biometrics not set up on this device." }, { status: 404 });
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge,
      expectedOrigin: webAuthnOriginFromRequest(request),
      expectedRPID: webAuthnRpId(),
      credential: {
        id: entry.webauthn.credentialId,
        publicKey: Buffer.from(entry.webauthn.publicKey, "base64url"),
        counter: entry.webauthn.counter,
        transports: entry.webauthn.transports as AuthenticatorTransport[] | undefined,
      },
      requireUserVerification: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!verification.verified) {
    return NextResponse.json({ error: "Could not verify biometrics." }, { status: 401 });
  }

  const user = await resolveUserByEmail(email);
  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  await upsertDeviceQuickAuth({
    ...entry,
    webauthn: {
      ...entry.webauthn,
      counter: verification.authenticationInfo.newCounter,
    },
  });

  const res = await buildLoginResponse(user, { redirect });
  res.cookies.set("ts_wa_auth", "", { path: "/", maxAge: 0 });
  return res;
}