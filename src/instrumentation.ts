export async function register() {
  const { requireConfiguredSessionSecret } = await import("@/lib/security-config");
  const secret = requireConfiguredSessionSecret();
  if (!secret) {
    console.error(
      "[train-station] FATAL: SESSION_SECRET must be set to a strong random value in production.",
    );
  }
}