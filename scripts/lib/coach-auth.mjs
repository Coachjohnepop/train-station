/**
 * Shared coach session helper for prod smoke tests.
 */

function parseSetCookie(headers) {
  const raw = headers.getSetCookie?.() || [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}

function mergeCookies(existing, added) {
  const jar = new Map();
  for (const part of `${existing}; ${added}`.split(";")) {
    const trimmed = part.trim();
    if (!trimmed || !trimmed.includes("=")) continue;
    const [k, ...rest] = trimmed.split("=");
    jar.set(k, rest.join("="));
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

export function createCoachClient(base, options = {}) {
  const coachEmail =
    options.coachEmail || process.env.COACH_EMAIL || "jeremy@thetrainstation.co";
  const passwordEnv =
    options.password ??
    process.env.COACH_PASSWORD ??
    process.env.COACH_TEST_PASSWORD ??
    null;

  let cookies = "";

  async function req(path, opts = {}) {
    const url = path.startsWith("http") ? path : `${base}${path}`;
    const headers = {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      ...(opts.headers || {}),
    };
    if (cookies) headers.Cookie = cookies;
    if (opts.json) {
      headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(opts.json);
    }
    const res = await fetch(url, { ...opts, headers, cache: "no-store" });
    const setCookie = parseSetCookie(res.headers);
    if (setCookie) cookies = mergeCookies(cookies, setCookie);

    const text = await res.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { res, body, text };
  }

  async function tryLogin(password) {
    const { res, body } = await req("/api/auth/login", {
      method: "POST",
      json: { email: coachEmail, password, redirect: "/admin" },
    });
    if (res.ok && cookies.includes("ts_session")) {
      return { ok: true, detail: password ? "password" : "no password" };
    }
    return { ok: false, detail: body?.error || `status ${res.status}` };
  }

  async function loginCoach({ onPass, onFail } = {}) {
    const attempts =
      passwordEnv !== null ? [passwordEnv] : ["CoachTest123!", ""];
    for (const password of attempts) {
      const result = await tryLogin(password);
      if (result.ok) {
        if (onPass) onPass("Coach login", `${coachEmail} (${result.detail})`);
        return true;
      }
    }
    if (onFail) {
      onFail(
        "Coach login",
        "set COACH_PASSWORD for prod accounts with a password",
      );
    }
    return false;
  }

  return { req, loginCoach, getCookies: () => cookies };
}