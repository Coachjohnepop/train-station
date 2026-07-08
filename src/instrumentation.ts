const DEV_SESSION_SECRET = "train-station-dev-session-secret-change-me";

/** Startup check only — must not import server-only or Node fs/path modules (edge runtime). */
export async function register() {
  const secret = process.env.SESSION_SECRET?.trim();
  const enforced =
    process.env.SECURITY_ENFORCED === "true" ||
    (process.env.SECURITY_ENFORCED !== "false" && process.env.NODE_ENV === "production");

  if (enforced && (!secret || secret === DEV_SESSION_SECRET)) {
    console.error(
      "[train-station] FATAL: SESSION_SECRET must be set to a strong random value in production.",
    );
  }
}