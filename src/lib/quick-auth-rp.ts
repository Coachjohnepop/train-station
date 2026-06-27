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
  const origins = webAuthnAllowedOrigins();
  return origins[0] || "http://localhost:3000";
}

/** Accept www and apex hostnames — members may land on either. */
export function webAuthnAllowedOrigins(): string[] {
  const origins = new Set<string>(["http://localhost:3000", "http://127.0.0.1:3000"]);
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) {
    try {
      const url = new URL(raw);
      origins.add(url.origin);
      const host = url.hostname.replace(/^www\./, "");
      if (host && host !== "localhost" && host !== "127.0.0.1") {
        origins.add(`${url.protocol}//${host}`);
        origins.add(`${url.protocol}//www.${host}`);
      }
    } catch {
      /* ignore */
    }
  }
  return [...origins];
}

export function webAuthnOriginFromRequest(request: Request): string | string[] {
  const header = request.headers.get("origin")?.trim();
  if (header) {
    try {
      const origin = new URL(header).origin;
      const allowed = webAuthnAllowedOrigins();
      if (allowed.includes(origin)) return origin;
      return [...allowed, origin];
    } catch {
      /* fall through */
    }
  }
  return webAuthnAllowedOrigins();
}

export function webAuthnRpName(): string {
  return "The Train Station";
}