/**
 * Mercury bank read client. The Platform Mercury tab uses this for balances,
 * registers, statements, cards, credit, treasury, and recipients.
 * Sending money stays in the Mercury dashboard.
 */

const MERCURY_BASE = "https://api.mercury.com/api/v1";

export function mercuryConfigured(): boolean {
  return Boolean(process.env.MERCURY_API_TOKEN?.trim());
}

async function mercuryGet<T>(path: string): Promise<T> {
  const token = process.env.MERCURY_API_TOKEN?.trim();
  if (!token) throw new Error("MERCURY_API_TOKEN is not configured");
  let res = await fetch(`${MERCURY_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.status >= 500) {
    await new Promise((r) => setTimeout(r, 1200));
    res = await fetch(`${MERCURY_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const detail = body.trimStart().startsWith("<")
      ? res.status >= 500
        ? "Mercury is briefly unavailable. Try again in a minute."
        : "unexpected HTML response"
      : body.slice(0, 200);
    throw new Error(`Mercury API ${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

export type MercuryAccount = {
  id: string;
  name: string;
  kind?: string | null;
  status?: string | null;
  availableBalance?: number | null;
  currentBalance?: number | null;
  legalBusinessName?: string | null;
  dashboardLink?: string | null;
};

export type MercuryTransaction = {
  id: string;
  amount: number;
  counterpartyName?: string | null;
  counterpartyNickname?: string | null;
  bankDescription?: string | null;
  externalMemo?: string | null;
  note?: string | null;
  kind?: string | null;
  status?: string | null;
  createdAt?: string | null;
  postedAt?: string | null;
  estimatedDeliveryDate?: string | null;
  dashboardLink?: string | null;
  checkNumber?: string | null;
  trackingNumber?: string | null;
  reasonForFailure?: string | null;
};

export type MercuryStatement = {
  id: string;
  startDate?: string | null;
  endDate?: string | null;
  endingBalance?: number | null;
  downloadUrl?: string | null;
};

export type MercuryCard = {
  cardId: string;
  nameOnCard?: string | null;
  lastFourDigits?: string | null;
  network?: string | null;
  status?: string | null;
  type?: string | null;
};

export type MercuryCreditAccount = {
  id: string;
  status?: string | null;
  availableBalance?: number | null;
  currentBalance?: number | null;
};

export async function listMercuryAccounts(): Promise<MercuryAccount[]> {
  const data = await mercuryGet<{ accounts?: MercuryAccount[] }>("/accounts");
  return data.accounts ?? [];
}

export async function listMercuryTransactions(
  accountId: string,
  opts?: { start?: Date; limit?: number },
): Promise<MercuryTransaction[]> {
  const params = new URLSearchParams();
  params.set("limit", String(opts?.limit ?? 500));
  if (opts?.start) params.set("start", opts.start.toISOString().slice(0, 10));
  const data = await mercuryGet<{ transactions?: MercuryTransaction[] }>(
    `/account/${accountId}/transactions?${params.toString()}`,
  );
  return data.transactions ?? [];
}

export async function listMercuryStatements(accountId: string): Promise<MercuryStatement[]> {
  const data = await mercuryGet<{ statements?: MercuryStatement[] }>(`/account/${accountId}/statements`);
  return data.statements ?? [];
}

export async function listMercuryCards(accountId: string): Promise<MercuryCard[]> {
  const data = await mercuryGet<{ cards?: MercuryCard[] }>(`/account/${accountId}/cards`);
  return data.cards ?? [];
}

export async function listMercuryCreditAccounts(): Promise<MercuryCreditAccount[]> {
  const data = await mercuryGet<{ accounts?: MercuryCreditAccount[] }>("/credit");
  return data.accounts ?? [];
}

export async function listMercuryTreasury(): Promise<
  { id: string; name?: string | null; amount?: number | null }[]
> {
  const data = await mercuryGet<{
    accounts?: { id: string; name?: string | null; amount?: number | null }[];
  }>("/treasury");
  return data.accounts ?? [];
}

export async function listMercuryRecipients(): Promise<
  { id: string; name: string; status?: string; paymentMethod?: string }[]
> {
  const data = await mercuryGet<{
    recipients?: { id: string; name: string; status?: string; paymentMethod?: string }[];
  }>("/recipients");
  return data.recipients ?? [];
}
