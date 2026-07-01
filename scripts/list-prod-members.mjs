#!/usr/bin/env node
import { createRequire } from "module";
import dotenv from "dotenv";

const require = createRequire(import.meta.url);
const Module = require("module");
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};
dotenv.config({ path: ".env.vercel.prod" });
dotenv.config({ path: ".env" });

const { listSelfRegisteredAccounts } = await import("../src/lib/member-accounts-store.ts");
const rows = await listSelfRegisteredAccounts();
for (const { email, account } of rows) {
  console.log(`${account.name || "—"}\t${email}\t${account.userId}`);
}