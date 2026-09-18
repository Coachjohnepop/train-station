/** Domains that should 301 to the canonical Train Station host. */

export const CANONICAL_HOST = "www.thetrainstation.co";

export const VANITY_REDIRECT_HOSTS = new Set(["allaboard.fit", "www.allaboard.fit"]);

export function requestHost(hostHeader: string | null | undefined): string {
  return (hostHeader || "").split(":")[0].trim().toLowerCase();
}

export function isVanityRedirectHost(hostHeader: string | null | undefined): boolean {
  return VANITY_REDIRECT_HOSTS.has(requestHost(hostHeader));
}

/**
 * Absolute https URL on the canonical host.
 * Vanity `/` is the 6:30am Zoom door (`/l/class`). Other paths pass through.
 */
export function canonicalSiteUrl(pathname: string, search = ""): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (path === "/" || path === "") {
    return `https://${CANONICAL_HOST}/l/class${search}`;
  }
  return `https://${CANONICAL_HOST}${path}${search}`;
}
