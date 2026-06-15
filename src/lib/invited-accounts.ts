import fs from "fs";
import path from "path";
import { normalizeAccountEmail } from "@/lib/account-email";

const ACCOUNTS_FILE = path.join(process.cwd(), "prisma", "accounts.dev.json");

/** Emails that can sign in and use the full app (coaches + beta members). */
export function isInvitedAccountEmail(email: string): boolean {
  const normalized = normalizeAccountEmail(email);
  if (!normalized) return false;

  try {
    if (fs.existsSync(ACCOUNTS_FILE)) {
      const accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf8")) as Record<string, unknown>;
      if (accounts[normalized]) return true;
    }
  } catch {
    /* ignore */
  }

  return false;
}