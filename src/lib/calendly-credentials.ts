import "server-only";

import path from "path";
import { isDemoMode } from "@/lib/demo-enrollments";
import { readLocalJson, writeLocalJson } from "@/lib/demo-json-blob";

export const CALENDLY_INTEGRATION_ID = "coach";
const DEV_FILE = path.join(process.cwd(), "prisma", "calendly-integration.dev.json");
const CACHE_TTL_MS = 15_000;

export type CalendlyStoredIntegration = {
  id: string;
  apiToken: string;
  webhookSigningKey: string | null;
  webhookUri: string | null;
  connectedEmail: string | null;
  connectedName: string | null;
  connectedAt: string | null;
  connectedByEmail: string | null;
};

export type CalendlyCredentials = {
  apiToken: string;
  webhookSigningKey: string;
  webhookUri: string | null;
  source: "env" | "db" | "mixed" | null;
  connectedEmail: string | null;
  connectedName: string | null;
};

let cache: { at: number; creds: CalendlyCredentials } | null = null;

export function envCalendlyApiToken(): string {
  return (
    process.env.CALENDLY_API_TOKEN?.trim() ||
    process.env.CALENDLY_PERSONAL_ACCESS_TOKEN?.trim() ||
    ""
  );
}

export function envCalendlyWebhookSigningKey(): string {
  return process.env.CALENDLY_WEBHOOK_SIGNING_KEY?.trim() || "";
}

export function envCalendlyWebhookSharedSecret(): string {
  return process.env.CALENDLY_WEBHOOK_SECRET?.trim() || "";
}

/** Sync env-only. Prefer resolveCalendlyApiToken() in request handlers. */
export function calendlyApiToken(): string {
  return envCalendlyApiToken() || cache?.creds.apiToken || "";
}

export function invalidateCalendlyCredentialCache(): void {
  cache = null;
}

function mergeEnv(row: CalendlyStoredIntegration | null): CalendlyCredentials {
  const envToken = envCalendlyApiToken();
  const envKey = envCalendlyWebhookSigningKey();
  const dbToken = row?.apiToken?.trim() || "";
  const dbKey = row?.webhookSigningKey?.trim() || "";
  const apiToken = envToken || dbToken;
  const webhookSigningKey = envKey || dbKey;
  let source: CalendlyCredentials["source"] = null;
  if (!apiToken && !webhookSigningKey) source = null;
  else if (envToken && !dbToken) source = "env";
  else if (!envToken && dbToken) source = "db";
  else if (envToken && dbToken) source = envKey && !dbKey ? "env" : "mixed";
  else source = envKey ? "env" : dbKey ? "db" : null;
  return {
    apiToken,
    webhookSigningKey,
    webhookUri: row?.webhookUri || null,
    source,
    connectedEmail: row?.connectedEmail || null,
    connectedName: row?.connectedName || null,
  };
}

async function loadRow(): Promise<CalendlyStoredIntegration | null> {
  if (isDemoMode()) {
    const raw = readLocalJson<CalendlyStoredIntegration>(DEV_FILE);
    if (!raw?.apiToken?.trim() && !raw?.webhookSigningKey?.trim()) return null;
    return raw;
  }
  try {
    const { prisma } = await import("@/lib/prisma");
    const row = await prisma.calendlyIntegration.findUnique({
      where: { id: CALENDLY_INTEGRATION_ID },
    });
    if (!row?.apiToken?.trim() && !row?.webhookSigningKey?.trim()) return null;
    return {
      id: row.id,
      apiToken: row.apiToken,
      webhookSigningKey: row.webhookSigningKey,
      webhookUri: row.webhookUri,
      connectedEmail: row.connectedEmail,
      connectedName: row.connectedName,
      connectedAt: row.connectedAt ? row.connectedAt.toISOString() : null,
      connectedByEmail: row.connectedByEmail,
    };
  } catch (e) {
    console.warn("[calendly-credentials] load failed", e);
    return null;
  }
}

export async function resolveCalendlyCredentials(): Promise<CalendlyCredentials> {
  const envToken = envCalendlyApiToken();
  const envKey = envCalendlyWebhookSigningKey();
  if (envToken && envKey) {
    return {
      apiToken: envToken,
      webhookSigningKey: envKey,
      webhookUri: cache?.creds.webhookUri || null,
      source: "env",
      connectedEmail: cache?.creds.connectedEmail || null,
      connectedName: cache?.creds.connectedName || null,
    };
  }
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return mergeEnv({
      id: CALENDLY_INTEGRATION_ID,
      apiToken: cache.creds.apiToken,
      webhookSigningKey: cache.creds.webhookSigningKey,
      webhookUri: cache.creds.webhookUri,
      connectedEmail: cache.creds.connectedEmail,
      connectedName: cache.creds.connectedName,
      connectedAt: null,
      connectedByEmail: null,
    });
  }
  const row = await loadRow();
  const creds = mergeEnv(row);
  cache = { at: Date.now(), creds };
  return creds;
}

export async function resolveCalendlyApiToken(): Promise<string> {
  const creds = await resolveCalendlyCredentials();
  return creds.apiToken;
}

export async function resolveCalendlyWebhookSigningKey(): Promise<string> {
  const creds = await resolveCalendlyCredentials();
  return creds.webhookSigningKey;
}

export async function saveCalendlyIntegration(input: {
  apiToken: string;
  webhookSigningKey?: string | null;
  webhookUri?: string | null;
  connectedEmail?: string | null;
  connectedName?: string | null;
  connectedByEmail?: string | null;
}): Promise<void> {
  const token = input.apiToken.trim();
  if (!token && !input.webhookSigningKey?.trim()) {
    throw new Error("Calendly token required.");
  }
  const existing = await loadRow();
  const row: CalendlyStoredIntegration = {
    id: CALENDLY_INTEGRATION_ID,
    apiToken: token,
    webhookSigningKey:
      input.webhookSigningKey !== undefined
        ? input.webhookSigningKey?.trim() || null
        : existing?.webhookSigningKey || null,
    webhookUri:
      input.webhookUri !== undefined ? input.webhookUri : existing?.webhookUri || null,
    connectedEmail: input.connectedEmail ?? existing?.connectedEmail ?? null,
    connectedName: input.connectedName ?? existing?.connectedName ?? null,
    connectedAt: new Date().toISOString(),
    connectedByEmail: input.connectedByEmail ?? existing?.connectedByEmail ?? null,
  };

  if (isDemoMode()) {
    writeLocalJson(DEV_FILE, row);
    invalidateCalendlyCredentialCache();
    return;
  }

  const { prisma } = await import("@/lib/prisma");
  await prisma.calendlyIntegration.upsert({
    where: { id: CALENDLY_INTEGRATION_ID },
    create: {
      id: CALENDLY_INTEGRATION_ID,
      apiToken: row.apiToken,
      webhookSigningKey: row.webhookSigningKey,
      webhookUri: row.webhookUri,
      connectedEmail: row.connectedEmail,
      connectedName: row.connectedName,
      connectedAt: new Date(),
      connectedByEmail: row.connectedByEmail,
    },
    update: {
      apiToken: row.apiToken,
      webhookSigningKey: row.webhookSigningKey,
      webhookUri: row.webhookUri,
      connectedEmail: row.connectedEmail,
      connectedName: row.connectedName,
      connectedAt: new Date(),
      connectedByEmail: row.connectedByEmail,
    },
  });
  invalidateCalendlyCredentialCache();
}

export async function patchCalendlyWebhookSecrets(input: {
  webhookSigningKey?: string | null;
  webhookUri?: string | null;
}): Promise<void> {
  const existing = await loadRow();
  await saveCalendlyIntegration({
    apiToken: existing?.apiToken || envCalendlyApiToken() || "",
    webhookSigningKey:
      input.webhookSigningKey !== undefined
        ? input.webhookSigningKey
        : existing?.webhookSigningKey,
    webhookUri: input.webhookUri !== undefined ? input.webhookUri : existing?.webhookUri,
    connectedEmail: existing?.connectedEmail,
    connectedName: existing?.connectedName,
    connectedByEmail: existing?.connectedByEmail,
  });
}

export async function clearCalendlyIntegration(): Promise<void> {
  if (isDemoMode()) {
    writeLocalJson(DEV_FILE, {
      id: CALENDLY_INTEGRATION_ID,
      apiToken: "",
      webhookSigningKey: null,
      webhookUri: null,
      connectedEmail: null,
      connectedName: null,
      connectedAt: null,
      connectedByEmail: null,
    } satisfies CalendlyStoredIntegration);
    invalidateCalendlyCredentialCache();
    return;
  }
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.calendlyIntegration.deleteMany({ where: { id: CALENDLY_INTEGRATION_ID } });
  } catch (e) {
    console.warn("[calendly-credentials] clear failed", e);
  }
  invalidateCalendlyCredentialCache();
}

export function calendlyPublicStatus(creds: CalendlyCredentials): {
  tokenConfigured: boolean;
  tokenSource: CalendlyCredentials["source"];
  webhookKeyConfigured: boolean;
  connectedEmail: string | null;
  connectedName: string | null;
} {
  return {
    tokenConfigured: Boolean(creds.apiToken),
    tokenSource: creds.source,
    webhookKeyConfigured: Boolean(creds.webhookSigningKey),
    connectedEmail: creds.connectedEmail,
    connectedName: creds.connectedName,
  };
}
