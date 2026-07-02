import "server-only";

export type XaiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type XaiChatOptions = {
  model?: string;
  /** grok-4.3 only — use "none" for fast, low-cost replies */
  reasoningEffort?: "none" | "low" | "medium" | "high";
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: "json_object" };
};

export function normalizeXaiApiKey(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  if (/^bearer\s+/i.test(key)) {
    key = key.replace(/^bearer\s+/i, "").trim();
  }
  key = key.replace(/\s+/g, "");
  return key || null;
}

export function xaiApiKey(): string | null {
  return normalizeXaiApiKey(process.env.XAI_API_KEY);
}

export function defaultXaiChatModel(): string {
  return process.env.XAI_CHAT_MODEL?.trim() || "grok-4.3";
}

export async function xaiChatCompletion(
  messages: XaiChatMessage[],
  options: XaiChatOptions = {},
): Promise<{ content: string } | { error: string; status?: number }> {
  const apiKey = xaiApiKey();
  if (!apiKey) {
    return { error: "missing XAI_API_KEY" };
  }

  const model = options.model?.trim() || defaultXaiChatModel();
  const body: Record<string, unknown> = {
    model,
    temperature: options.temperature ?? 0.3,
    max_completion_tokens: options.maxTokens ?? 600,
    messages,
  };

  if (model.startsWith("grok-4.3")) {
    body.reasoning_effort = options.reasoningEffort ?? "none";
  }
  if (options.responseFormat) {
    body.response_format = options.responseFormat;
  }

  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("[xai] chat error:", res.status, model, errBody.slice(0, 400));
      if (res.status === 401) {
        return { error: "xAI API key rejected — check XAI_API_KEY in Vercel.", status: res.status };
      }
      if (res.status === 403) {
        return {
          error: "xAI API forbidden — add billing/credits at console.x.ai or check team API access.",
          status: res.status,
        };
      }
      if (res.status === 404) {
        return {
          error: `xAI model not found (${model}) — set XAI_COACH_HELP_MODEL or XAI_CHAT_MODEL.`,
          status: res.status,
        };
      }
      return { error: "xAI request failed", status: res.status };
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      return { error: "xAI returned an empty reply" };
    }
    return { content: content.trim() };
  } catch (err) {
    console.error("[xai] chat request failed", err);
    return { error: "xAI connection failed" };
  }
}

/** Lightweight check — used from prod to verify XAI_API_KEY without exposing it. */
export async function probeXaiApi(): Promise<{
  ok: boolean;
  status?: number;
  model: string;
  keyLength: number;
  keyPrefixOk: boolean;
}> {
  const key = xaiApiKey();
  const model = defaultXaiChatModel();
  const meta = {
    model,
    keyLength: key?.length ?? 0,
    keyPrefixOk: Boolean(key && /^xai-/i.test(key)),
  };
  if (!key) return { ok: false, ...meta };
  const result = await xaiChatCompletion([{ role: "user", content: "Reply: ok" }], {
    reasoningEffort: "none",
    maxTokens: 8,
  });
  if ("error" in result) {
    return { ok: false, status: result.status, ...meta };
  }
  return { ok: true, status: 200, ...meta };
}