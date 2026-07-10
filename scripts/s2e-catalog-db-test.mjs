#!/usr/bin/env node
/**
 * Slice 2e — coach catalog Postgres migration path.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 npm run test:s2e
 */

const BASE = process.env.BASE_URL || "http://localhost:3000";
const COACH_EMAIL = process.env.COACH_EMAIL || "jeremy@thetrainstation.co";
const COACH_PASSWORD_ENV =
  process.env.COACH_PASSWORD ?? process.env.COACH_TEST_PASSWORD ?? null;

const results = [];
let cookies = "";

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.log(`❌ ${name}${detail ? ` — ${detail}` : ""}`);
}

function parseSetCookie(headers) {
  const raw = headers.getSetCookie?.() || [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}

async function tryLogin(password) {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: COACH_EMAIL,
      password,
      redirect: "/admin/programs",
    }),
    redirect: "manual",
  });
  const setCookie = parseSetCookie(loginRes.headers);
  if (loginRes.ok && setCookie.includes("ts_session")) {
    cookies = setCookie;
    return true;
  }
  return false;
}

async function loginCoach() {
  const attempts =
    COACH_PASSWORD_ENV !== null ? [COACH_PASSWORD_ENV] : ["CoachTest123!", ""];
  for (const password of attempts) {
    if (await tryLogin(password)) {
      pass("Coach login", COACH_EMAIL);
      return true;
    }
  }
  fail("Coach login", "set COACH_PASSWORD for prod");
  return false;
}

async function main() {
  console.log(`\nS2e catalog DB test\nBASE: ${BASE}\n`);

  if (!(await loginCoach())) process.exit(1);

  const persistence = await fetch(`${BASE}/api/admin/demo-persistence`, {
    headers: { Cookie: cookies },
    cache: "no-store",
  });
  const persistBody = await persistence.json();
  if (!persistence.ok) {
    fail("Persistence status", `${persistence.status}`);
    process.exit(1);
  }
  pass(
    "Persistence status",
    persistBody.demoMode ? "demo (blob)" : "database (durable)",
  );

  const status = await fetch(`${BASE}/api/admin/catalog/status`, {
    headers: { Cookie: cookies },
    cache: "no-store",
  });
  const statusBody = await status.json();
  if (!status.ok) {
    fail("Catalog status API", `${status.status}`);
    process.exit(1);
  }

  if (!statusBody.storage || !statusBody.counts) {
    fail("Catalog status shape");
    process.exit(1);
  }
  pass(
    "Catalog status",
    `${statusBody.storage} · ${statusBody.counts.exercises} exercises · ${statusBody.counts.programDays} days`,
  );

  const programs = await fetch(`${BASE}/api/programs`, {
    headers: { Cookie: cookies },
    cache: "no-store",
  });
  const programList = await programs.json();
  if (!programs.ok || !Array.isArray(programList)) {
    fail("Programs API", `${programs.status}`);
    process.exit(1);
  }
  const adult = programList.find((p) => p.slug === "adult");
  if (!adult) {
    fail("Adult program listed");
    process.exit(1);
  }
  pass("Adult program in catalog", adult.name);

  const skipImport =
    process.env.SKIP_CATALOG_IMPORT === "1" ||
    (BASE.includes("thetrainstation.co") && statusBody.storage === "database");

  if (skipImport) {
    pass("Import skipped", "prod Postgres catalog protected");
  } else {
    const importRes = await fetch(`${BASE}/api/admin/catalog/import`, {
      method: "POST",
      headers: { Cookie: cookies },
      cache: "no-store",
    });
    const importBody = await importRes.json();
    if (statusBody.demoMode) {
      if (importRes.status === 409 && importBody.skipped) {
        pass("Import guarded in demo mode");
      } else {
        fail("Import should 409 in demo mode", `${importRes.status}`);
        process.exit(1);
      }
    } else if (importRes.ok && importBody.ok) {
      pass("Import from blob", `${importBody.exercises} exercises`);
    } else {
      fail("Catalog import", `${importRes.status} ${JSON.stringify(importBody)}`);
      process.exit(1);
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n---\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
  console.log("\nS2e acceptance: PASS\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});