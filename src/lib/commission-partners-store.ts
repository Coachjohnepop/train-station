import "server-only";

import { randomUUID } from "crypto";
import path from "path";
import { isDemoMode } from "@/lib/demo-enrollments";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";
import {
  deleteCommissionPartnerFromDb,
  getCommissionPartnerFromDb,
  listCommissionPartnersFromDb,
  upsertCommissionPartnerToDb,
} from "@/lib/commission-partners-db";
import {
  commissionUsesPoolSplit,
  type CommissionSplitMode,
} from "@/lib/stripe-commission";

export type CommissionPartner = {
  id: string;
  name: string;
  email: string;
  stripeAccountId: string | null;
  /** Flat mode: % of gross MRR. Milestone/tiered: % of the partner pool (enabled partners sum to 100). */
  sharePercent: number;
  enabled: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type PartnersStore = {
  partners: CommissionPartner[];
  updatedAt: string;
};

const BLOB_PATH = "demo/commission-partners.json";
const DEV_FILE = path.join(process.cwd(), "prisma", "commission-partners.dev.json");
const LEGACY_BLOB_PATH = "demo/commission-config.json";
const LEGACY_DEV_FILE = path.join(process.cwd(), "prisma", "commission-config.dev.json");

let memoryStore: PartnersStore | null = null;

function emptyStore(): PartnersStore {
  return { partners: [], updatedAt: new Date().toISOString() };
}

function normalizePartner(raw: unknown): CommissionPartner | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<CommissionPartner>;
  if (!data.id || !data.name || !data.email) return null;
  const share = Number(data.sharePercent);
  return {
    id: data.id,
    name: data.name.trim(),
    email: data.email.trim().toLowerCase(),
    stripeAccountId:
      typeof data.stripeAccountId === "string" && data.stripeAccountId.trim()
        ? data.stripeAccountId.trim()
        : null,
    sharePercent: Number.isFinite(share) ? Math.max(0, Math.min(100, share)) : 0,
    enabled: data.enabled !== false,
    notes: typeof data.notes === "string" ? data.notes : null,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
}

function normalizeStore(raw: unknown): PartnersStore {
  if (!raw || typeof raw !== "object") return emptyStore();
  const data = raw as Partial<PartnersStore>;
  const partners = Array.isArray(data.partners)
    ? data.partners
        .map(normalizePartner)
        .filter((p): p is CommissionPartner => Boolean(p))
    : [];
  return {
    partners,
    updatedAt:
      typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
  };
}

async function readLegacyPartner(): Promise<Partial<CommissionPartner> | null> {
  const legacy = await hydrateJsonStore({
    blobPath: LEGACY_BLOB_PATH,
    localPath: LEGACY_DEV_FILE,
    memory: null,
    setMemory: () => {},
    fallback: () => null,
  });
  if (!legacy || typeof legacy !== "object") return null;
  const data = legacy as Record<string, unknown>;
  const accountId =
    typeof data.partnerAccountId === "string" ? data.partnerAccountId.trim() : null;
  const email =
    typeof data.partnerEmail === "string"
      ? data.partnerEmail.trim()
      : process.env.STRIPE_COMMISSION_PARTNER_EMAIL?.trim() || null;
  const name =
    typeof data.partnerName === "string"
      ? data.partnerName.trim()
      : process.env.STRIPE_COMMISSION_PARTNER_NAME?.trim() || null;
  if (!accountId && !email && !name) return null;
  return {
    name: name || "Partner",
    email: email || "",
    stripeAccountId: accountId,
    sharePercent: 100,
    enabled: true,
    notes: "Imported from legacy commission config",
  };
}

function defaultMilestonePartnerSeed(): CommissionPartner[] {
  const now = new Date().toISOString();
  return [
    {
      id: randomUUID(),
      name: "John Popham · Business Partner",
      email: "john@thetrainstation.co",
      stripeAccountId: null,
      sharePercent: 100,
      enabled: true,
      notes:
        "Dev & partnership fee pool (TS master Stripe Connect). Eco Delight coffee partner draws use Eco Stripe Express (john@thetrainstation.co / JOHNPARTNER) — separate platform.",
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function seedPartnersFromEnv(): CommissionPartner[] {
  const raw = process.env.STRIPE_COMMISSION_SEED_JSON?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      const now = new Date().toISOString();
      const partners: CommissionPartner[] = [];
      for (const entry of parsed) {
        if (!entry || typeof entry !== "object") continue;
        const data = entry as Record<string, unknown>;
        const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
        const name = typeof data.name === "string" ? data.name.trim() : "";
        if (!email || !name) continue;
        const share = Number(data.sharePercent);
        partners.push({
          id: randomUUID(),
          name,
          email,
          stripeAccountId:
            typeof data.stripeAccountId === "string" ? data.stripeAccountId.trim() : null,
          sharePercent: Number.isFinite(share) ? Math.max(0, Math.min(100, share)) : 0,
          enabled: data.enabled !== false,
          notes: typeof data.notes === "string" ? data.notes : null,
          createdAt: now,
          updatedAt: now,
        });
      }
      return partners;
    } catch {
      return [];
    }
  }

  const email = process.env.STRIPE_COMMISSION_PARTNER_EMAIL?.trim();
  if (!email) return [];
  const now = new Date().toISOString();
  return [
    {
      id: randomUUID(),
      name: process.env.STRIPE_COMMISSION_PARTNER_NAME?.trim() || "Partner",
      email: email.toLowerCase(),
      stripeAccountId: process.env.STRIPE_CONNECT_PARTNER_ACCOUNT_ID?.trim() || null,
      sharePercent: 100,
      enabled: true,
      notes: null,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

async function ensureMigratedStore(): Promise<PartnersStore> {
  const hydrated = await hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory: (v) => {
      memoryStore = normalizeStore(v);
    },
    fallback: emptyStore,
  });

  let store = normalizeStore(hydrated);
  if (store.partners.length === 0) {
    const legacy = await readLegacyPartner();
    const now = new Date().toISOString();
    if (legacy?.email || legacy?.stripeAccountId) {
      store = {
        partners: [
          {
            id: randomUUID(),
            name: legacy.name || "Partner",
            email: (legacy.email || "").toLowerCase(),
            stripeAccountId: legacy.stripeAccountId ?? null,
            sharePercent: 100,
            enabled: true,
            notes: legacy.notes ?? null,
            createdAt: now,
            updatedAt: now,
          },
        ],
        updatedAt: now,
      };
    } else {
      let seeded = seedPartnersFromEnv();
      if (seeded.length === 0 && process.env.STRIPE_COMMISSION_ENABLED !== "false") {
        const mode = process.env.STRIPE_COMMISSION_MODE?.trim().toLowerCase();
        if (mode !== "flat" && mode !== "tiered") {
          seeded = defaultMilestonePartnerSeed();
        }
      }
      if (seeded.length > 0) {
        store = { partners: seeded, updatedAt: now };
      }
    }

    if (store.partners.length > 0) {
      await persistJsonStore({
        blobPath: BLOB_PATH,
        localPath: DEV_FILE,
        data: store,
        setMemory: (v) => {
          memoryStore = normalizeStore(v);
        },
      });
    }
  }

  memoryStore = store;
  return store;
}

export async function listCommissionPartners(): Promise<CommissionPartner[]> {
  if (!isDemoMode()) return listCommissionPartnersFromDb();
  const store = await ensureMigratedStore();
  return [...store.partners].sort((a, b) => a.name.localeCompare(b.name));
}

export async function listEnabledCommissionPartners(): Promise<CommissionPartner[]> {
  const partners = await listCommissionPartners();
  return partners.filter((p) => p.enabled && p.sharePercent > 0);
}

export async function getCommissionPartner(id: string): Promise<CommissionPartner | null> {
  if (!isDemoMode()) return getCommissionPartnerFromDb(id);
  const store = await ensureMigratedStore();
  const partner = store.partners.find((p) => p.id === id);
  return partner ? normalizePartner(partner) : null;
}

export async function createCommissionPartner(input: {
  name: string;
  email: string;
  sharePercent?: number;
  notes?: string | null;
}): Promise<CommissionPartner> {
  const now = new Date().toISOString();
  const partner: CommissionPartner = {
    id: randomUUID(),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    stripeAccountId: null,
    sharePercent:
      input.sharePercent !== undefined
        ? Math.max(0, Math.min(100, input.sharePercent))
        : 0,
    enabled: true,
    notes: input.notes?.trim() || null,
    createdAt: now,
    updatedAt: now,
  };

  if (!isDemoMode()) {
    await upsertCommissionPartnerToDb(partner);
    return partner;
  }

  const store = await ensureMigratedStore();
  store.partners.push(partner);
  store.updatedAt = now;
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory: (v) => {
      memoryStore = normalizeStore(v);
    },
  });

  return partner;
}

export async function updateCommissionPartner(
  id: string,
  patch: Partial<
    Pick<
      CommissionPartner,
      "name" | "email" | "sharePercent" | "enabled" | "notes" | "stripeAccountId"
    >
  >,
): Promise<CommissionPartner> {
  const current = !isDemoMode()
    ? await getCommissionPartnerFromDb(id)
    : (await ensureMigratedStore()).partners.find((p) => p.id === id) ?? null;
  if (!current) throw new Error("Partner not found");

  const next: CommissionPartner = {
    ...current,
    ...patch,
    name: patch.name !== undefined ? patch.name.trim() : current.name,
    email: patch.email !== undefined ? patch.email.trim().toLowerCase() : current.email,
    sharePercent:
      patch.sharePercent !== undefined
        ? Math.max(0, Math.min(100, patch.sharePercent))
        : current.sharePercent,
    notes: patch.notes !== undefined ? patch.notes?.trim() || null : current.notes,
    updatedAt: new Date().toISOString(),
  };

  if (!isDemoMode()) {
    await upsertCommissionPartnerToDb(next);
    return next;
  }

  const store = await ensureMigratedStore();
  const storeIdx = store.partners.findIndex((p) => p.id === id);
  if (storeIdx < 0) throw new Error("Partner not found");
  store.partners[storeIdx] = next;
  store.updatedAt = next.updatedAt;
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory: (v) => {
      memoryStore = normalizeStore(v);
    },
  });

  return next;
}

export async function deleteCommissionPartner(id: string): Promise<boolean> {
  if (!isDemoMode()) return deleteCommissionPartnerFromDb(id);
  const store = await ensureMigratedStore();
  const before = store.partners.length;
  store.partners = store.partners.filter((p) => p.id !== id);
  if (store.partners.length === before) return false;
  store.updatedAt = new Date().toISOString();
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory: (v) => {
      memoryStore = normalizeStore(v);
    },
  });
  return true;
}

export function sumEnabledSharePercents(partners: CommissionPartner[]): number {
  return partners
    .filter((p) => p.enabled && p.sharePercent > 0)
    .reduce((sum, p) => sum + p.sharePercent, 0);
}

export function validatePartnerShares(
  partners: CommissionPartner[],
  mode: CommissionSplitMode,
): { shareTotal: number; shareValid: boolean; message: string | null } {
  const shareTotal = sumEnabledSharePercents(partners);
  if (shareTotal <= 0) {
    return { shareTotal, shareValid: false, message: "Add at least one enabled partner with a share." };
  }
  if (mode === "flat") {
    if (shareTotal > 100) {
      return {
        shareTotal,
        shareValid: false,
        message: `Partner shares cannot exceed 100% of revenue (currently ${shareTotal}%).`,
      };
    }
    return { shareTotal, shareValid: true, message: null };
  }
  if (commissionUsesPoolSplit(mode) && shareTotal !== 100) {
    return {
      shareTotal,
      shareValid: false,
      message: `Enabled partner shares must total 100% of the commission pool (currently ${shareTotal}%).`,
    };
  }
  return { shareTotal, shareValid: true, message: null };
}