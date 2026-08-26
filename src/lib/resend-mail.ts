import "server-only";

import { BRAND_NAME } from "@/lib/brand";
import { isOutboundMessagingEnabled } from "@/lib/messaging-gate";

export type ResendEmailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  ctaUrl?: string;
  ctaLabel?: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
  headers?: Record<string, string>;
};

function siteHostname(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim() ||
    "https://www.thetrainstation.co";
  try {
    return new URL(fromEnv.startsWith("http") ? fromEnv : `https://${fromEnv}`).hostname
      .toLowerCase()
      .replace(/^www\./, "");
  } catch {
    return "thetrainstation.co";
  }
}

/** Verified Resend sending subdomain — never prefix with www. */
export function resendSendingDomain(): string {
  const configured = process.env.RESEND_SEND_DOMAIN?.trim();
  if (configured) return configured.replace(/^www\./, "");
  return `send.${siteHostname()}`;
}

/** First usable address from a raw env/input (comma lists are invalid as Resend reply_to). */
export function firstEmailAddress(raw?: string | null): string | undefined {
  if (!raw?.trim()) return undefined;
  for (const part of raw.split(/[,;]/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const angled = trimmed.match(/^(.*)<([^>]+)>\s*$/);
    const email = (angled?.[2] || trimmed).trim();
    if (/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) {
      return angled ? trimmed : email;
    }
  }
  return undefined;
}

function domainFromAddress(from: string): string | null {
  const match = from.match(/<([^>]+)>/);
  const addr = (match?.[1] || from).trim();
  return addr.split("@")[1]?.toLowerCase() || null;
}

function isUnverifiedApex(domain: string | null): boolean {
  return domain === "thetrainstation.co";
}

/** Fallback FROM — same TS send domain unless RESEND_FROM_FALLBACK is set. */
export function resendFallbackFrom(): string {
  return (
    process.env.RESEND_FROM_FALLBACK?.trim() ||
    `${BRAND_NAME} <accounts@${resendSendingDomain()}>`
  );
}

/** Derive accounts@… from LEAD_NOTIFY_FROM only when that domain is not the unverified apex. */
function accountsFromLeadNotifyFrom(): string | null {
  const leadFrom = process.env.LEAD_NOTIFY_FROM?.trim();
  if (!leadFrom) return null;

  const match = leadFrom.match(/<([^>]+)>/);
  const email = (match?.[1] || leadFrom).trim();
  const at = email.lastIndexOf("@");
  if (at <= 0) return null;
  const domain = email.slice(at + 1).toLowerCase();
  if (isUnverifiedApex(domain)) return null;

  return `${BRAND_NAME} <accounts${email.slice(at)}>`;
}

/** Single verified sender — must match a domain verified at resend.com/domains */
export function resendFromAddress(): string {
  const explicit =
    process.env.RESEND_FROM?.trim() ||
    process.env.PASSWORD_RESET_FROM?.trim() ||
    process.env.MESSAGE_HUB_FROM?.trim() ||
    process.env.MEMBER_WELCOME_FROM?.trim();
  if (explicit && !isUnverifiedApex(domainFromAddress(explicit))) return explicit;

  const leadAccounts = accountsFromLeadNotifyFrom();
  if (leadAccounts) return leadAccounts;

  const domain = resendSendingDomain();
  if (!isUnverifiedApex(domain)) {
    return `${BRAND_NAME} <accounts@${domain}>`;
  }

  return resendFallbackFrom();
}

export function resendReplyTo(): string {
  return (
    firstEmailAddress(process.env.RESEND_REPLY_TO) ||
    firstEmailAddress(process.env.LEAD_NOTIFY_REPLY_TO) ||
    firstEmailAddress(process.env.COACH_NOTIFY_EMAIL) ||
    "jeremy@thetrainstation.co"
  );
}

export function resendFromDomain(): string | null {
  return domainFromAddress(resendFromAddress());
}

export function resendFromLooksMisconfigured(): boolean {
  const domain = resendFromDomain();
  if (!domain) return true;
  if (domain === "resend.dev" || domain.endsWith(".resend.dev")) return true;
  if (domain.includes("www.")) return true;

  const expected = resendSendingDomain().toLowerCase();
  const leadDomain = resendFromDomainFromAddress(process.env.LEAD_NOTIFY_FROM?.trim() || "");
  if (leadDomain && domain === leadDomain) return false;

  if (domain !== expected) return true;
  return false;
}

function resendFromDomainFromAddress(from: string): string | null {
  return domainFromAddress(from);
}

function wrapHtml(bodyText: string, ctaUrl?: string, ctaLabel?: string): string {
  const paragraphs = bodyText
    .split(/\n\n+/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.5;color:#1a1a1a;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  const cta =
    ctaUrl && ctaLabel
      ? `<p style="margin:24px 0;"><a href="${ctaUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600;">${ctaLabel}</a></p>`
      : "";

  const site = siteHostname();

  return `<!DOCTYPE html><html><body style="font-family:system-ui,-apple-system,sans-serif;background:#f6f4fa;padding:24px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;border:1px solid #e8e0f0;">
<p style="margin:0 0 20px;font-weight:700;color:#7c3aed;">${BRAND_NAME}</p>
${paragraphs}
${cta}
<p style="margin:24px 0 0;font-size:12px;color:#6b7280;">Reply to this or hit Messages in the app.</p>
<p style="margin:12px 0 0;font-size:11px;color:#9ca3af;">${BRAND_NAME} · ${site}</p>
</div></body></html>`;
}

export async function sendResendEmail(input: ResendEmailInput): Promise<boolean> {
  const { categoryFromEmailTags, recordOutboundNotification } = await import(
    "@/lib/outbound-notifications"
  );
  const category = categoryFromEmailTags(input.tags, input.subject);
  const toList = Array.isArray(input.to) ? input.to : [input.to];
  const toAddress = toList.filter(Boolean).join(", ");

  const logEmail = async (
    status: "sent" | "failed" | "skipped_paused" | "skipped_no_key" | "skipped_misconfigured",
    extra?: { providerId?: string | null; errorMessage?: string | null; metadata?: Record<string, unknown> },
  ) => {
    await recordOutboundNotification({
      channel: "email",
      category,
      status,
      toAddress,
      subject: input.subject,
      bodyPreview: input.text,
      provider: "resend",
      providerId: extra?.providerId ?? null,
      errorMessage: extra?.errorMessage ?? null,
      metadata: {
        tags: input.tags ?? null,
        ctaUrl: input.ctaUrl ?? null,
        ...extra?.metadata,
      },
    });
  };

  if (!(await isOutboundMessagingEnabled())) {
    console.log(
      `[RESEND — paused] To: ${input.to}\nSubject: ${input.subject}\n(Admin → Coach settings or MESSAGING_ENABLED=false)\n`,
    );
    await logEmail("skipped_paused");
    return false;
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.log(`[RESEND — not configured] To: ${input.to}\nSubject: ${input.subject}\n${input.text}\n`);
    await logEmail("skipped_no_key");
    return false;
  }

  if (process.env.NODE_ENV === "production" && resendFromLooksMisconfigured()) {
    console.warn(
      `[RESEND] FROM domain may hurt deliverability (${resendFromDomain()}). ` +
        `Expected ${resendSendingDomain()}. Verify at resend.com/domains and set RESEND_FROM.`,
    );
  }

  const to = toList;
  const replyTo = firstEmailAddress(input.replyTo) || resendReplyTo();
  const headers: Record<string, string> = {
    "X-Entity-Ref-ID": `ts-${Date.now()}`,
    ...input.headers,
  };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendFromAddress(),
        to,
        reply_to: replyTo,
        subject: input.subject,
        text: input.text,
        html: input.html || wrapHtml(input.text, input.ctaUrl, input.ctaLabel),
        tags: input.tags,
        headers,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[RESEND] send failed:", res.status, body, "from:", resendFromAddress());

      const fallback = resendFallbackFrom();
      const primary = resendFromAddress();
      if (
        res.status === 403 &&
        body.includes("not verified") &&
        fallback &&
        fallback !== primary
      ) {
        const retry = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fallback,
            to,
            reply_to: replyTo,
            subject: input.subject,
            text: input.text,
            html: input.html || wrapHtml(input.text, input.ctaUrl, input.ctaLabel),
            tags: input.tags,
            headers,
          }),
        });
        if (retry.ok) {
          let providerId: string | null = null;
          try {
            const j = (await retry.json()) as { id?: string };
            providerId = j.id ?? null;
          } catch {
            /* ignore */
          }
          console.warn("[RESEND] sent via verified fallback from:", fallback);
          await logEmail("sent", {
            providerId,
            metadata: { from: fallback, fallback: true },
          });
          return true;
        }
        const retryBody = await retry.text();
        console.error("[RESEND] fallback send failed:", retry.status, retryBody);
        await logEmail("failed", {
          errorMessage: `primary ${res.status}: ${body.slice(0, 300)}; fallback ${retry.status}: ${retryBody.slice(0, 300)}`,
        });
        return false;
      }

      await logEmail("failed", {
        errorMessage: `${res.status}: ${body.slice(0, 500)}`,
      });
      return false;
    }

    let providerId: string | null = null;
    try {
      const j = (await res.json()) as { id?: string };
      providerId = j.id ?? null;
    } catch {
      /* ignore */
    }
    await logEmail("sent", { providerId });
    return true;
  } catch (err) {
    console.error("[RESEND] send failed", err);
    await logEmail("failed", {
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

export function transactionalSubject(kind: string): string {
  switch (kind) {
    case "password-reset":
      return `Reset your ${BRAND_NAME} password`;
    case "hub":
      return `${BRAND_NAME} message from your coach`;
    case "welcome":
      return `Welcome to ${BRAND_NAME}`;
    case "intro booked":
      return `You're booked with Jeremy`;
    case "workout-complete":
      return `Workout logged. Nice work`;
    default:
      return BRAND_NAME;
  }
}