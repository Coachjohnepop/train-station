export type MemberChatWindow = {
  joinAfterIso: string | null;
  clearedAtIso: string | null;
};

export function messageInLiveView(createdAt: string, w: MemberChatWindow | undefined): boolean {
  if (!w) return true;
  if (w.joinAfterIso && createdAt < w.joinAfterIso) return false;
  if (w.clearedAtIso && createdAt <= w.clearedAtIso) return false;
  return true;
}

export function messageInArchiveView(createdAt: string, w: MemberChatWindow | undefined): boolean {
  if (!w?.clearedAtIso) return false;
  if (w.joinAfterIso && createdAt < w.joinAfterIso) return false;
  return createdAt <= w.clearedAtIso;
}
