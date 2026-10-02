"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";
import { saveProgramImageAction } from "@/app/admin/programs/actions";
import { HERO_IMAGE_MAX_BYTES } from "@/lib/hero-slides";
import { resolveProgramImage } from "@/lib/program-constants";

const IMAGE_MAX_MB = Math.round(HERO_IMAGE_MAX_BYTES / (1024 * 1024));
const IMAGE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,image/avif,.jpg,.jpeg,.png,.webp,.gif,.avif";

function extFromFile(file: File): string {
  const name = file.name.toLowerCase();
  if (name.endsWith(".png") || file.type.includes("png")) return "png";
  if (name.endsWith(".webp") || file.type.includes("webp")) return "webp";
  if (name.endsWith(".gif") || file.type.includes("gif")) return "gif";
  if (name.endsWith(".avif") || file.type.includes("avif")) return "avif";
  return "jpg";
}

/**
 * Program image for Admin → Programs (list + program page).
 * Uploads a photo and saves the same image on landing Explore cards.
 */
export default function AdminProgramCoverField({
  slug,
  name,
  coverUrl: initialCover,
}: {
  slug: string;
  name: string;
  coverUrl?: string | null;
}) {
  const [coverUrl, setCoverUrl] = useState(initialCover || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const preview = resolveProgramImage(slug, coverUrl || null);
  const defaultUrl = resolveProgramImage(slug, null);
  const usingCustom = Boolean(coverUrl.trim()) && coverUrl.trim() !== defaultUrl;

  async function persist(nextUrl: string | null) {
    setBusy(true);
    setMsg(null);
    try {
      const result = await saveProgramImageAction({ slug, imageUrl: nextUrl });
      if ("error" in result && result.error) throw new Error(result.error);
      const stored = "imageUrl" in result ? result.imageUrl : nextUrl;
      setCoverUrl(stored || "");
      setMsg("Program image saved — same photo on landing Explore.");
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadImage(file: File) {
    if (file.size > HERO_IMAGE_MAX_BYTES) {
      setMsg(`${file.name}: too large (max ${IMAGE_MAX_MB} MB).`);
      return;
    }
    setBusy(true);
    setMsg(`Uploading ${file.name}…`);
    try {
      const ext = extFromFile(file);
      const pathname = `hero/programs/${slug}-${crypto.randomUUID()}.${ext}`;
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
      await persist(url);
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
      setBusy(false);
    }
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="mt-3 flex flex-col gap-2 border-t border-[var(--border)] pt-3 sm:flex-row sm:items-center"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={preview}
        alt=""
        className="h-20 w-36 shrink-0 rounded-lg object-cover ring-1 ring-[var(--border)]"
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-[var(--text)]">Program image</p>
        <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">
          Same photo as this program on landing Explore. Tap Replace photo to change it.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <label className="btn-secondary inline-flex min-h-10 cursor-pointer items-center px-3 text-xs font-semibold">
            {busy ? "Saving…" : "Replace photo"}
            <input
              type="file"
              accept={IMAGE_ACCEPT}
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void uploadImage(file);
              }}
            />
          </label>
          {usingCustom ? (
            <button
              type="button"
              className="btn-ghost min-h-10 px-3 text-xs"
              disabled={busy}
              onClick={() => void persist(null)}
            >
              Default photo
            </button>
          ) : null}
        </div>
        {msg ? <p className="mt-1 text-[11px] text-[var(--muted)]">{msg}</p> : (
          <span className="sr-only">{name} program image</span>
        )}
      </div>
    </div>
  );
}
