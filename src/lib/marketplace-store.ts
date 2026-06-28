/**
 * Marketplace scaffold — supplements, apparel, equipment (own inventory + affiliate/resell).
 * Admin UI and checkout wiring come later; blob-backed like other site config.
 */
import path from "path";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";

export type MarketplaceFulfillment = "in_house" | "dropship" | "affiliate";

export type MarketplaceProduct = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: "supplement" | "apparel" | "equipment" | "other";
  priceCents: number;
  imageUrl: string | null;
  externalUrl: string | null;
  fulfillment: MarketplaceFulfillment;
  active: boolean;
  sortOrder: number;
  updatedAt: string;
};

export type MarketplaceConfig = {
  enabled: boolean;
  headline: string | null;
  products: MarketplaceProduct[];
  updatedAt: string;
};

const DEV_FILE = path.join(process.cwd(), "prisma", "marketplace.dev.json");
const BLOB_PATH = "demo/marketplace.json";

let memoryStore: MarketplaceConfig | null = null;

function emptyConfig(): MarketplaceConfig {
  return {
    enabled: false,
    headline: "Gear & supplements — curated for your program",
    products: [],
    updatedAt: new Date().toISOString(),
  };
}

function normalize(raw: unknown): MarketplaceConfig {
  if (!raw || typeof raw !== "object") return emptyConfig();
  const data = raw as Partial<MarketplaceConfig>;
  return {
    enabled: Boolean(data.enabled),
    headline: typeof data.headline === "string" ? data.headline : emptyConfig().headline,
    products: Array.isArray(data.products) ? (data.products as MarketplaceProduct[]) : [],
    updatedAt:
      typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
  };
}

export async function getMarketplaceConfig(): Promise<MarketplaceConfig> {
  const hydrated = await hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory: (v) => {
      memoryStore = normalize(v);
    },
    fallback: emptyConfig,
  });
  const config = normalize(hydrated);
  memoryStore = config;
  return config;
}

export async function saveMarketplaceConfig(
  patch: Partial<Pick<MarketplaceConfig, "enabled" | "headline" | "products">>,
): Promise<MarketplaceConfig> {
  const current = await getMarketplaceConfig();
  const next: MarketplaceConfig = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: next,
    setMemory: (v) => {
      memoryStore = normalize(v);
    },
  });

  return next;
}