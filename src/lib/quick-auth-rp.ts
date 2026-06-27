import "server-only";

function appHostname(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
  try {
    return new URL(raw).hostname;
  } catch {
    return "localhost";
  }
}

export function webAuthnRpId(): string {
  const override = process.env.WEBAUTHN_RP_ID?.trim();
  if (override) return override;
  const host = appHostname();
  if (host === "localhost" || host === "127.0.0.1") return "localhost";
  return host.replace(/^www\./, "");
}

export function webAuthnOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) {
    try {
      return new URL(raw).origin;
    } catch {
      /* fall through */
    }
  }
  return "http://localhost:3000";
}

export function webAuthnRpName(): string {
  return "The Train Station";
}