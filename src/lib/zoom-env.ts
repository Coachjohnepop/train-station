import "server-only";

/** Read Zoom env at request time — avoids Next build inlining stale credentials. */
export function zoomClientId(): string {
  return process.env["ZOOM_CLIENT_ID"]?.trim() || "";
}

export function zoomClientSecret(): string {
  return process.env["ZOOM_CLIENT_SECRET"]?.trim() || "";
}

export function zoomAccountId(): string {
  return process.env["ZOOM_ACCOUNT_ID"]?.trim() || "";
}