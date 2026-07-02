import "server-only";

import { randomUUID } from "crypto";
import path from "path";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";

export type CoachHelpSuggestion = {
  id: string;
  coachEmail: string;
  coachName: string;
  pagePath: string | null;
  userMessage: string;
  assistantReply: string;
  createdAt: string;
  readAt: string | null;
};

type SuggestionsStore = {
  suggestions: CoachHelpSuggestion[];
  updatedAt: string;
};

const BLOB_PATH = "demo/coach-help-suggestions.json";
const DEV_FILE = path.join(process.cwd(), "prisma", "coach-help-suggestions.dev.json");

let memoryStore: SuggestionsStore | null = null;

function emptyStore(): SuggestionsStore {
  return { suggestions: [], updatedAt: new Date().toISOString() };
}

function normalizeStore(raw: unknown): SuggestionsStore {
  if (!raw || typeof raw !== "object") return emptyStore();
  const data = raw as Partial<SuggestionsStore>;
  const suggestions = Array.isArray(data.suggestions)
    ? data.suggestions.filter(
        (s): s is CoachHelpSuggestion =>
          Boolean(s && typeof s === "object" && typeof (s as CoachHelpSuggestion).id === "string"),
      )
    : [];
  return {
    suggestions,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
  };
}

async function getStore(): Promise<SuggestionsStore> {
  const hydrated = await hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory: (v) => {
      memoryStore = normalizeStore(v);
    },
    fallback: emptyStore,
  });
  memoryStore = normalizeStore(hydrated);
  return memoryStore;
}

export async function appendCoachHelpSuggestion(input: {
  coachEmail: string;
  coachName: string;
  pagePath?: string | null;
  userMessage: string;
  assistantReply: string;
}): Promise<CoachHelpSuggestion> {
  const store = await getStore();
  const entry: CoachHelpSuggestion = {
    id: `help-${randomUUID().slice(0, 8)}`,
    coachEmail: input.coachEmail,
    coachName: input.coachName,
    pagePath: input.pagePath?.trim() || null,
    userMessage: input.userMessage.trim(),
    assistantReply: input.assistantReply.trim(),
    createdAt: new Date().toISOString(),
    readAt: null,
  };
  const next: SuggestionsStore = {
    suggestions: [entry, ...store.suggestions].slice(0, 200),
    updatedAt: new Date().toISOString(),
  };
  memoryStore = next;
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: next,
    setMemory: (v) => {
      memoryStore = normalizeStore(v);
    },
  });
  return entry;
}

export async function listCoachHelpSuggestions(opts?: {
  unreadOnly?: boolean;
}): Promise<CoachHelpSuggestion[]> {
  const store = await getStore();
  const rows = [...store.suggestions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  if (opts?.unreadOnly) return rows.filter((s) => !s.readAt);
  return rows;
}

export async function markCoachHelpSuggestionRead(id: string): Promise<boolean> {
  const store = await getStore();
  let found = false;
  const suggestions = store.suggestions.map((s) => {
    if (s.id !== id) return s;
    found = true;
    return { ...s, readAt: s.readAt || new Date().toISOString() };
  });
  if (!found) return false;
  const next = { suggestions, updatedAt: new Date().toISOString() };
  memoryStore = next;
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: next,
    setMemory: (v) => {
      memoryStore = normalizeStore(v);
    },
  });
  return true;
}

export async function countUnreadCoachHelpSuggestions(): Promise<number> {
  const store = await getStore();
  return store.suggestions.filter((s) => !s.readAt).length;
}