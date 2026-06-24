const DEV_SESSION_SECRET = "train-station-dev-session-secret-change-me";

export function resolveSessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  return secret || DEV_SESSION_SECRET;
}

export function isDefaultSessionSecret(secret: string): boolean {
  return secret === DEV_SESSION_SECRET;
}