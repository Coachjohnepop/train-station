import { COMING_SOON_PROGRAMS, SERVICE_OFFERS } from "@/lib/product-offers";
import { PROGRAM_IMAGES } from "@/lib/program-constants";
import { TOP_LEVEL_PROGRAMS, type CatalogStatus } from "@/lib/programs";

export type ExploreCardKind = "program" | "coming_soon" | "service";

export type ExploreCardOverride = {
  /** Same words as the Explore card title. Null = catalog / offer name. */
  name: string | null;
  /** Small kicker above the program name. */
  subtitle: string | null;
  /** Paragraph under the program name. */
  description: string | null;
  imageUrl: string | null;
};

export type ExploreContentConfig = {
  cards: Record<string, ExploreCardOverride>;
};

export type ExploreCardDef = {
  id: string;
  kind: ExploreCardKind;
  name: string;
  subtitle: string;
  description: string;
  imageUrl: string | null;
  emoji?: string;
  priceLabel?: string;
  priceNote?: string;
  catalogStatus?: CatalogStatus;
};

export type ResolvedExploreCard = ExploreCardDef & {
  /** Catalog / offer name before any admin override. */
  catalogName: string;
};

export const EXPLORE_NAME_MAX = 80;
export const EXPLORE_SUBTITLE_MAX = 48;
export const EXPLORE_DESCRIPTION_MAX = 320;

const PROGRAM_SUBTITLE = "On the platform";
const COMING_SOON_SUBTITLE = "Coming soon";
const SERVICE_SUBTITLE = "Services & extras";

function programDefs(): ExploreCardDef[] {
  return TOP_LEVEL_PROGRAMS.filter(
    (p) => p.catalogStatus === "live" || p.catalogStatus === "coming_soon",
  ).map((p) => ({
    id: p.slug,
    kind: "program" as const,
    name: p.name,
    subtitle: PROGRAM_SUBTITLE,
    description: p.description,
    imageUrl: PROGRAM_IMAGES[p.slug] || "/images/programs/adult.jpg",
    catalogStatus: p.catalogStatus,
  }));
}

function comingSoonDefs(): ExploreCardDef[] {
  return COMING_SOON_PROGRAMS.map((p) => ({
    id: p.slug,
    kind: "coming_soon" as const,
    name: p.name,
    subtitle: COMING_SOON_SUBTITLE,
    description: p.blurb,
    imageUrl: null,
    emoji: p.emoji,
  }));
}

function serviceDefs(): ExploreCardDef[] {
  return SERVICE_OFFERS.map((offer) => ({
    id: offer.id,
    kind: "service" as const,
    name: offer.label,
    subtitle: SERVICE_SUBTITLE,
    description: offer.description,
    imageUrl: PROGRAM_IMAGES[offer.id] || null,
    priceLabel: offer.priceLabel,
    priceNote: offer.priceNote,
  }));
}

export function defaultExploreCatalog(): ExploreCardDef[] {
  return [...programDefs(), ...comingSoonDefs(), ...serviceDefs()];
}

export const EXPLORE_CARD_IDS = defaultExploreCatalog().map((card) => card.id);

const CATALOG_BY_ID = new Map(defaultExploreCatalog().map((card) => [card.id, card]));

export function emptyExploreContent(): ExploreContentConfig {
  return { cards: {} };
}

function cleanText(raw: unknown, max: number): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > max ? text.slice(0, max) : text;
}

export function isAllowedExploreImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed.length <= 2000 && !trimmed.includes("://");
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function cleanImageUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || !isAllowedExploreImageUrl(trimmed)) return null;
  return trimmed.slice(0, 2000);
}

function emptyOverride(): ExploreCardOverride {
  return { name: null, subtitle: null, description: null, imageUrl: null };
}

function cleanOverride(raw: unknown): ExploreCardOverride {
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    name: cleanText(data.name, EXPLORE_NAME_MAX),
    subtitle: cleanText(data.subtitle, EXPLORE_SUBTITLE_MAX),
    description: cleanText(data.description, EXPLORE_DESCRIPTION_MAX),
    imageUrl: cleanImageUrl(data.imageUrl),
  };
}

export function normalizeExploreContent(raw: unknown): ExploreContentConfig {
  const data = raw && typeof raw === "object" ? (raw as { cards?: unknown }) : {};
  const incoming =
    data.cards && typeof data.cards === "object" && !Array.isArray(data.cards)
      ? (data.cards as Record<string, unknown>)
      : {};
  const cards: Record<string, ExploreCardOverride> = {};
  for (const id of EXPLORE_CARD_IDS) {
    if (!(id in incoming)) continue;
    const next = cleanOverride(incoming[id]);
    if (next.name || next.subtitle || next.description || next.imageUrl) {
      cards[id] = next;
    }
  }
  return { cards };
}

export function resolveExploreCard(
  def: ExploreCardDef,
  override?: ExploreCardOverride | null,
): ResolvedExploreCard {
  return {
    ...def,
    catalogName: def.name,
    name: override?.name?.trim() || def.name,
    subtitle: override?.subtitle?.trim() || def.subtitle,
    description: override?.description?.trim() || def.description,
    imageUrl: override?.imageUrl?.trim() || def.imageUrl,
  };
}

export function resolveExploreCards(
  config: ExploreContentConfig | null | undefined,
): ResolvedExploreCard[] {
  const cards = config?.cards || {};
  return defaultExploreCatalog().map((def) => resolveExploreCard(def, cards[def.id]));
}

export function exploreCopyById(
  config: ExploreContentConfig | null | undefined,
): Record<string, { name?: string; description?: string }> {
  const out: Record<string, { name?: string; description?: string }> = {};
  for (const card of resolveExploreCards(config)) {
    const hit: { name?: string; description?: string } = {};
    if (card.name) hit.name = card.name;
    if (card.description) hit.description = card.description;
    if (hit.name || hit.description) out[card.id] = hit;
  }
  return out;
}

export function catalogDefForExploreId(id: string): ExploreCardDef | null {
  return CATALOG_BY_ID.get(id) ?? null;
}

export function patchExploreContent(
  current: ExploreContentConfig,
  patch: Record<string, Partial<ExploreCardOverride>>,
): ExploreContentConfig {
  const cards: Record<string, ExploreCardOverride> = { ...current.cards };
  for (const [id, row] of Object.entries(patch)) {
    if (!CATALOG_BY_ID.has(id)) continue;
    const prev = cards[id] || emptyOverride();
    const next = cleanOverride({
      name: row.name !== undefined ? row.name : prev.name,
      subtitle: row.subtitle !== undefined ? row.subtitle : prev.subtitle,
      description: row.description !== undefined ? row.description : prev.description,
      imageUrl: row.imageUrl !== undefined ? row.imageUrl : prev.imageUrl,
    });
    if (next.name || next.subtitle || next.description || next.imageUrl) {
      cards[id] = next;
    } else {
      delete cards[id];
    }
  }
  return { cards };
}
