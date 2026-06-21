import type { ChatMessage } from "@/lib/coach-chat";

function sortMessages(messages: ChatMessage[]) {
  return [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function messageSnapshotEqual(a: ChatMessage, b: ChatMessage) {
  return (
    a.id === b.id &&
    JSON.stringify(a.reactions ?? []) === JSON.stringify(b.reactions ?? []) &&
    a.body === b.body
  );
}

export function chatMessagesEqual(a: ChatMessage[], b: ChatMessage[]) {
  if (a.length !== b.length) return false;
  return a.every((m, i) => messageSnapshotEqual(m, b[i]!));
}

/** Union merge — never drop local messages when a stale poll returns fewer rows. */
export function mergeChatMessages(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (incoming.length === 0 && prev.length > 0) return prev;

  const byId = new Map<string, ChatMessage>();
  for (const m of prev) byId.set(m.id, m);
  for (const m of incoming) {
    const existing = byId.get(m.id);
    byId.set(m.id, existing ? { ...existing, ...m } : m);
  }
  return sortMessages(Array.from(byId.values()));
}

export function applyChatMessageLoad(
  prev: ChatMessage[],
  incoming: ChatMessage[],
  opts?: { replace?: boolean },
): ChatMessage[] {
  const next = opts?.replace ? sortMessages(incoming) : mergeChatMessages(prev, incoming);
  return chatMessagesEqual(prev, next) ? prev : next;
}