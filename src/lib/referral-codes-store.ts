import "server-only";

import { randomUUID } from "crypto";
import path from "path";
import { isDemoMode } from "@/lib/demo-enrollments";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";
import {
  deleteReferralCodeFromDb,
  getReferralCodeByCodeFromDb,
  getReferralCodeByIdFromDb,
  listReferralCodesFromDb,
  upsertReferralCodeToDb,
} from "@/lib/referral-codes-db";

export type ReferralCode = {
  id: string;
  /** Member-facing code, e.g. FRIEND10 */
  code: string;
  label: string;
  /** Stripe promotion code id (promo_…) — preferred at checkout */
  stripePromotionCodeId: string | null;
  /** Stripe coupon id (coupon_…) — fallback if no promotion code */
  stripeCouponId: string | null;
  /** Optional member user id that owns this referral link */
  ownerUserId: string | null;
  enabled: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type ReferralStore = {
  codes: ReferralCode[];
  updatedAt: string;
};

const BLOB_PATH = "demo/referral-codes.json";
const DEV_FILE = path.join(process.cwd(), "prisma", "referral-codes.dev.json");

let memoryStore: ReferralStore | null = null;

function emptyStore(): ReferralStore {
  return { codes: [], updatedAt: new Date().toISOString() };
}

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

function normalizeReferralCode(raw: unknown): ReferralCode | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<ReferralCode>;
  if (!data.id || !data.code) return null;
  const code = normalizeCode(data.code);
  if (!code) return null;
  return {
    id: data.id,
    code,
    label: typeof data.label === "string" && data.label.trim() ? data.label.trim() : code,
    stripePromotionCodeId:
      typeof data.stripePromotionCodeId === "string" && data.stripePromotionCodeId.trim()
        ? data.stripePromotionCodeId.trim()
        : null,
    stripeCouponId:
      typeof data.stripeCouponId === "string" && data.stripeCouponId.trim()
        ? data.stripeCouponId.trim()
        : null,
    ownerUserId:
      typeof data.ownerUserId === "string" && data.ownerUserId.trim()
        ? data.ownerUserId.trim()
        : null,
    enabled: data.enabled !== false,
    notes: typeof data.notes === "string" ? data.notes : null,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
}

function normalizeStore(raw: unknown): ReferralStore {
  if (!raw || typeof raw !== "object") return emptyStore();
  const data = raw as Partial<ReferralStore>;
  const codes = Array.isArray(data.codes)
    ? data.codes.map(normalizeReferralCode).filter((c): c is ReferralCode => Boolean(c))
    : [];
  return {
    codes,
    updatedAt:
      typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
  };
}

function seedFromEnv(): ReferralCode[] {
  const raw = process.env.STRIPE_REFERRAL_SEED_JSON?.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const now = new Date().toISOString();
    const codes: ReferralCode[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const data = entry as Record<string, unknown>;
      const code = typeof data.code === "string" ? normalizeCode(data.code) : "";
      if (!code) continue;
      codes.push({
        id: randomUUID(),
        code,
        label: typeof data.label === "string" ? data.label.trim() : code,
        stripePromotionCodeId:
          typeof data.stripePromotionCodeId === "string"
            ? data.stripePromotionCodeId.trim()
            : null,
        stripeCouponId:
          typeof data.stripeCouponId === "string" ? data.stripeCouponId.trim() : null,
        ownerUserId:
          typeof data.ownerUserId === "string" ? data.ownerUserId.trim() : null,
        enabled: data.enabled !== false,
        notes: typeof data.notes === "string" ? data.notes : null,
        createdAt: now,
        updatedAt: now,
      });
    }
    return codes;
  } catch {
    return [];
  }
}

async function ensureStore(): Promise<ReferralStore> {
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
  if (store.codes.length === 0) {
    const seeded = seedFromEnv();
    if (seeded.length > 0) {
      store = { codes: seeded, updatedAt: new Date().toISOString() };
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

export async function listReferralCodes(): Promise<ReferralCode[]> {
  if (!isDemoMode()) return listReferralCodesFromDb();
  const store = await ensureStore();
  return [...store.codes].sort((a, b) => a.code.localeCompare(b.code));
}

export async function getReferralCodeByCode(code: string): Promise<ReferralCode | null> {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  if (!isDemoMode()) return getReferralCodeByCodeFromDb(normalized);
  const store = await ensureStore();
  const found = store.codes.find((c) => c.code === normalized);
  return found ? normalizeReferralCode(found) : null;
}

export async function createReferralCode(input: {
  code: string;
  label?: string;
  stripePromotionCodeId?: string | null;
  stripeCouponId?: string | null;
  ownerUserId?: string | null;
  notes?: string | null;
}): Promise<ReferralCode> {
  const code = normalizeCode(input.code);
  if (!code) throw new Error("Referral code is required.");
  if (!isDemoMode()) {
    if (await getReferralCodeByCodeFromDb(code)) {
      throw new Error("That referral code already exists.");
    }
  } else {
    const store = await ensureStore();
    if (store.codes.some((c) => c.code === code)) {
      throw new Error("That referral code already exists.");
    }
  }

  const now = new Date().toISOString();
  const entry: ReferralCode = {
    id: randomUUID(),
    code,
    label: input.label?.trim() || code,
    stripePromotionCodeId: input.stripePromotionCodeId?.trim() || null,
    stripeCouponId: input.stripeCouponId?.trim() || null,
    ownerUserId: input.ownerUserId?.trim() || null,
    enabled: true,
    notes: input.notes?.trim() || null,
    createdAt: now,
    updatedAt: now,
  };

  if (!isDemoMode()) {
    await upsertReferralCodeToDb(entry);
    return entry;
  }

  const store = await ensureStore();
  store.codes.push(entry);
  store.updatedAt = now;
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory: (v) => {
      memoryStore = normalizeStore(v);
    },
  });

  return entry;
}

export async function updateReferralCode(
  id: string,
  patch: Partial<
    Pick<
      ReferralCode,
      | "code"
      | "label"
      | "stripePromotionCodeId"
      | "stripeCouponId"
      | "ownerUserId"
      | "enabled"
      | "notes"
    >
  >,
): Promise<ReferralCode> {
  const current = !isDemoMode()
    ? await getReferralCodeByIdFromDb(id)
    : (await ensureStore()).codes.find((c) => c.id === id) ?? null;
  if (!current) throw new Error("Referral code not found.");

  if (!isDemoMode()) {
    const nextCode = patch.code !== undefined ? normalizeCode(patch.code) : current.code;
    if (!nextCode) throw new Error("Referral code is required.");
    const existing = await getReferralCodeByCodeFromDb(nextCode);
    if (existing && existing.id !== id) {
      throw new Error("That referral code already exists.");
    }
  } else {
    const store = await ensureStore();
    const nextCode =
      patch.code !== undefined ? normalizeCode(patch.code) : current.code;
    if (!nextCode) throw new Error("Referral code is required.");
    if (store.codes.some((c) => c.id !== id && c.code === nextCode)) {
      throw new Error("That referral code already exists.");
    }
  }

  const nextCode =
    patch.code !== undefined ? normalizeCode(patch.code) : current.code;
  if (!nextCode) throw new Error("Referral code is required.");

  const next: ReferralCode = {
    ...current,
    ...patch,
    code: nextCode,
    label: patch.label !== undefined ? patch.label.trim() || nextCode : current.label,
    stripePromotionCodeId:
      patch.stripePromotionCodeId !== undefined
        ? patch.stripePromotionCodeId?.trim() || null
        : current.stripePromotionCodeId,
    stripeCouponId:
      patch.stripeCouponId !== undefined
        ? patch.stripeCouponId?.trim() || null
        : current.stripeCouponId,
    ownerUserId:
      patch.ownerUserId !== undefined
        ? patch.ownerUserId?.trim() || null
        : current.ownerUserId,
    notes: patch.notes !== undefined ? patch.notes?.trim() || null : current.notes,
    updatedAt: new Date().toISOString(),
  };

  if (!isDemoMode()) {
    await upsertReferralCodeToDb(next);
    return next;
  }

  const store = await ensureStore();
  const idx = store.codes.findIndex((c) => c.id === id);
  if (idx < 0) throw new Error("Referral code not found.");
  store.codes[idx] = next;
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

export async function deleteReferralCode(id: string): Promise<boolean> {
  if (!isDemoMode()) return deleteReferralCodeFromDb(id);
  const store = await ensureStore();
  const before = store.codes.length;
  store.codes = store.codes.filter((c) => c.id !== id);
  if (store.codes.length === before) return false;
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