const DEVICE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidDeviceId(value: unknown): value is string {
  return typeof value === "string" && DEVICE_ID_RE.test(value.trim());
}

export function normalizeDeviceId(value: unknown): string | null {
  if (!isValidDeviceId(value)) return null;
  return value.trim().toLowerCase();
}