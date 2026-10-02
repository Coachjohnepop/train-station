"use client";

import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { saveExploreContentAction } from "@/app/admin/landing/actions";
import {
  EXPLORE_DESCRIPTION_MAX,
  EXPLORE_NAME_MAX,
  EXPLORE_SUBTITLE_MAX,
  defaultExploreCatalog,
  normalizeExploreContent,
  resolveExploreCards,
  type ExploreCardKind,
  type ExploreCardOverride,
  type ExploreContentConfig,
  type ResolvedExploreCard,
} from "@/lib/explore-content";
import { HERO_IMAGE_MAX_BYTES } from "@/lib/hero-slides";

const IMAGE_MAX_MB = Math.round(HERO_IMAGE_MAX_BYTES / (1024 * 1024));
const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif,.jpg,.jpeg,.png,.webp,.gif,.avif";

const KIND_LABEL: Record<ExploreCardKind, string> = {
  program: "On the platform",
  coming_soon: "Coming soon",
  service: "Services & extras",
};

function extFromFile(file: File): string {
  const name = file.name.toLowerCase();
  if (name.endsWith(".png") || file.type.includes("png")) return "png";
  if (name.endsWith(".webp") || file.type.includes("webp")) return "webp";
  if (name.endsWith(".gif") || file.type.includes("gif")) return "gif";
  if (name.endsWith(".avif") || file.type.includes("avif")) return "avif";
  return "jpg";
}

function storedFromResolved(cards: ResolvedExploreCard[]): ExploreContentConfig {
  const catalog = new Map(defaultExploreCatalog().map((card) => [card.id, card]));
  const rows: Record<string, ExploreCardOverride> = {};
  for (const card of cards) {
    const def = catalog.get(card.id);
    if (!def) continue;
    rows[card.id] = {
      name: card.name.trim() || null,
      subtitle: card.subtitle.trim() || null,
      description: card.description.trim() || null,
      imageUrl: card.imageUrl?.trim() || null,
    };
  }
  return normalizeExploreContent({ cards: rows });
}

export default function AdminExploreContentPanel({
  initial,
}: {
  initial: ExploreContentConfig;
}) {
  const [cards, setCards] = useState<ResolvedExploreCard[]>(() =>
    resolveExploreCards(normalizeExploreContent(initial)),
  );
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<number>(0);
  const cardsRef = useRef(cards);
  cardsRef.current = cards;

  useEffect(() => {
    return () => window.clearTimeout(saveTimer.current);
  }, []);

  function patchCard(id: string, patch: Partial<ResolvedExploreCard>) {
    setCards((prev) => prev.map((card) => (card.id === id ? { ...card, ...patch } : card)));
  }

  async function persist(next = cardsRef.current) {
    setSaving(true);
    const result = await saveExploreContentAction(storedFromResolved(next));
    setSaving(false);
    if ("error" in result && result.error) {
      setError(result.error);
      setMessage(null);
      return false;
    }
    if ("storedExploreContent" in result && result.storedExploreContent) {
      const stored = resolveExploreCards(result.storedExploreContent);
      setCards(stored);
      cardsRef.current = stored;
    }
    setError(null);
    setMessage("Explore Content is live — program names on the cards are these same words.");
    return true;
  }

  function scheduleSave() {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void persist();
    }, 700);
  }

  async function uploadImage(id: string, file: File) {
    if (file.size > HERO_IMAGE_MAX_BYTES) {
      setError(`${file.name}: too large (max ${IMAGE_MAX_MB} MB).`);
      return;
    }
    setUploadingId(id);
    setError(null);
    setMessage(`Uploading ${file.name}…`);
    try {
      const ext = extFromFile(file);
      const pathname = `hero/explore/${id}-${crypto.randomUUID()}.${ext}`;
      let url: string | null = null;
      try {
        const blob = await upload(pathname, file, {
          access: "public",
          handleUploadUrl: "/api/admin/landing-media/hero-upload",
          contentType: file.type || "image/jpeg",
          multipart: file.size > 4 * 1024 * 1024,
        });
        url = blob.url;
      } catch (clientErr) {
        if (file.size > 4.5 * 1024 * 1024) throw clientErr;
      }
      if (!url) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/admin/landing-media/hero-upload", {
          method: "POST",
          body: form,
        });
        const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
        if (!res.ok || !data.url) throw new Error(data.error || "Upload failed");
        url = data.url;
      }
      const next = cardsRef.current.map((card) =>
        card.id === id ? { ...card, imageUrl: url } : card,
      );
      setCards(next);
      cardsRef.current = next;
      await persist(next);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setMessage(null);
    } finally {
      setUploadingId(null);
    }
  }

  function resetImage(id: string) {
    const def = defaultExploreCatalog().find((card) => card.id === id);
    patchCard(id, { imageUrl: def?.imageUrl ?? null });
    scheduleSave();
  }

  const groups: ExploreCardKind[] = ["program", "coming_soon", "service"];

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Explore Content</h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
          Photos and words on the landing Explore feed. The title on each card is the program
          name — same words as the catalog. Edit the subtitle and description around it.
        </p>
      </div>

      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      {groups.map((kind) => {
        const group = cards.filter((card) => card.kind === kind);
        if (!group.length) return null;
        return (
          <div key={kind} className="space-y-4">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--accent-fg)]">
              {KIND_LABEL[kind]}
            </h3>
            {group.map((card) => {
              const busy = uploadingId === card.id;
              const sameWords = card.name.trim() === card.catalogName;
              return (
                <article
                  key={card.id}
                  className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-lg bg-black sm:h-32 sm:w-44">
                      {card.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={card.imageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-4xl">
                          {card.emoji || "📷"}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                        {card.id}
                      </p>
                      <label className="block text-xs font-semibold text-[var(--text)]">
                        Program name
                        <input
                          className="input mt-1 w-full text-sm font-semibold"
                          maxLength={EXPLORE_NAME_MAX}
                          value={card.name}
                          onChange={(e) => {
                            patchCard(card.id, { name: e.target.value });
                            scheduleSave();
                          }}
                          aria-describedby={`explore-name-help-${card.id}`}
                        />
                      </label>
                      <p
                        id={`explore-name-help-${card.id}`}
                        className="text-[11px] leading-snug text-[var(--muted)]"
                      >
                        Same words as the Explore card title
                        {sameWords ? ` and the catalog name “${card.catalogName}”.` : "."}{" "}
                        Change it here and guests see this name on the card.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <label className="btn-ghost inline-flex min-h-10 cursor-pointer items-center px-3 text-xs font-semibold">
                      {busy ? "Uploading…" : "Replace photo"}
                      <input
                        type="file"
                        accept={IMAGE_ACCEPT}
                        className="hidden"
                        disabled={busy || saving}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) void uploadImage(card.id, file);
                        }}
                      />
                    </label>
                    {card.imageUrl ? (
                      <button
                        type="button"
                        className="btn-ghost min-h-10 px-3 text-xs"
                        disabled={busy || saving}
                        onClick={() => resetImage(card.id)}
                      >
                        Default photo
                      </button>
                    ) : null}
                  </div>

                  <label className="block text-xs font-semibold text-[var(--text)]">
                    Subtitle
                    <input
                      className="input mt-1 w-full text-sm"
                      maxLength={EXPLORE_SUBTITLE_MAX}
                      value={card.subtitle}
                      onChange={(e) => {
                        patchCard(card.id, { subtitle: e.target.value });
                        scheduleSave();
                      }}
                    />
                    <span className="mt-1 block font-normal text-[11px] text-[var(--muted)]">
                      Small line above the program name.
                    </span>
                  </label>

                  <label className="block text-xs font-semibold text-[var(--text)]">
                    Description
                    <textarea
                      className="input mt-1 min-h-[4.5rem] w-full text-sm"
                      maxLength={EXPLORE_DESCRIPTION_MAX}
                      value={card.description}
                      onChange={(e) => {
                        patchCard(card.id, { description: e.target.value });
                        scheduleSave();
                      }}
                    />
                    <span className="mt-1 block font-normal text-[11px] text-[var(--muted)]">
                      Paragraph under the program name on this Explore card.
                    </span>
                  </label>
                </article>
              );
            })}
          </div>
        );
      })}

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn-primary min-h-11 px-4 text-sm font-semibold"
          disabled={saving || Boolean(uploadingId)}
          onClick={() => void persist()}
        >
          {saving ? "Saving…" : "Save Explore Content"}
        </button>
        {saving ? (
          <span className="text-xs text-[var(--muted)]">Saving…</span>
        ) : null}
      </div>
    </section>
  );
}
