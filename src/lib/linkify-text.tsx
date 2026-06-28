import type { ReactNode } from "react";

const URL_PATTERN =
  /(?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:!?)\]}]/gi;

const SITE_HOST = "thetrainstation.co";

function normalizeHref(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  if (/^www\./i.test(candidate)) {
    candidate = `https://${candidate}`;
  } else if (!/^https?:\/\//i.test(candidate)) {
    if (/^thetrainstation\.co/i.test(candidate) || /^[a-z0-9.-]+\.thetrainstation\.co/i.test(candidate)) {
      candidate = `https://${candidate}`;
    } else {
      return null;
    }
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function trailingPunctuation(raw: string): { core: string; suffix: string } {
  const match = raw.match(/^(.+?)([),.;:!?]+)?$/);
  if (!match) return { core: raw, suffix: "" };
  return { core: match[1] || raw, suffix: match[2] || "" };
}

export function linkifyText(text: string | null | undefined, className?: string): ReactNode[] {
  if (!text) return [""];
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const index = match.index ?? 0;
    const raw = match[0];
    if (index > lastIndex) {
      nodes.push(text.slice(lastIndex, index));
    }

    const { core, suffix } = trailingPunctuation(raw);
    const href = normalizeHref(core);
    if (href) {
      const external = !href.includes(SITE_HOST);
      nodes.push(
        <a
          key={`link-${key++}`}
          href={href}
          className={className || "text-[var(--accent)] underline underline-offset-2 hover:opacity-90"}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
        >
          {core}
        </a>,
      );
      if (suffix) nodes.push(suffix);
    } else {
      nodes.push(raw);
    }

    lastIndex = index + raw.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length ? nodes : [text];
}