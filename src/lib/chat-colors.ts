import type { ChatMessageKind } from "@/lib/coach-chat";
import type { MemberCoachingMode } from "@/lib/member-coaching-mode";

/** Visual tokens for coach Messages — scannable on phone at a glance. */
export const CHAT_MODE_COLORS: Record<
  MemberCoachingMode,
  { label: string; stripe: string; chip: string; chipText: string; section: string }
> = {
  live: {
    label: "Live",
    stripe: "bg-emerald-500",
    chip: "bg-emerald-500/20 ring-emerald-400/40",
    chipText: "text-emerald-300",
    section: "border-emerald-500/30 bg-emerald-950/20",
  },
  async: {
    label: "Asynch",
    stripe: "bg-sky-500",
    chip: "bg-sky-500/20 ring-sky-400/40",
    chipText: "text-sky-300",
    section: "border-sky-500/30 bg-sky-950/20",
  },
};

export const CHAT_COHORT_COLORS = {
  stripe: "bg-violet-500",
  chip: "bg-violet-500/20 ring-violet-400/40",
  chipText: "text-violet-300",
  section: "border-violet-500/30 bg-violet-950/20",
};

export const CHAT_KIND_COLORS: Record<
  ChatMessageKind | "coach_text" | "member_text",
  { bubble: string; badge: string; badgeText: string }
> = {
  coach_text: {
    bubble: "bg-violet-600/35 ring-1 ring-violet-400/35",
    badge: "bg-violet-500/25",
    badgeText: "text-violet-200",
  },
  member_text: {
    bubble: "bg-emerald-600/25 ring-1 ring-emerald-400/30",
    badge: "bg-emerald-500/25",
    badgeText: "text-emerald-200",
  },
  text: {
    bubble: "bg-[var(--surface-2)]",
    badge: "bg-[var(--surface-2)]",
    badgeText: "text-[var(--muted)]",
  },
  member_sms: {
    bubble: "bg-emerald-600/30 ring-1 ring-emerald-400/40",
    badge: "bg-emerald-500/30",
    badgeText: "text-[var(--success)]",
  },
  workout_update: {
    bubble: "bg-amber-600/20 ring-1 ring-amber-400/40",
    badge: "bg-amber-500/30",
    badgeText: "text-amber-100",
  },
  youtube: {
    bubble: "bg-rose-600/20 ring-1 ring-rose-400/35",
    badge: "bg-rose-500/30",
    badgeText: "text-rose-100",
  },
  video_upload: {
    bubble: "bg-blue-600/25 ring-1 ring-blue-400/35",
    badge: "bg-blue-500/30",
    badgeText: "text-blue-100",
  },
  image: {
    bubble: "bg-fuchsia-600/20 ring-1 ring-fuchsia-400/35",
    badge: "bg-fuchsia-500/30",
    badgeText: "text-fuchsia-100",
  },
  system: {
    bubble: "bg-[var(--surface-2)]",
    badge: "bg-[var(--surface-2)]",
    badgeText: "text-[var(--muted)]",
  },
};

const AVATAR_HUES = [
  "bg-violet-600",
  "bg-emerald-600",
  "bg-sky-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-fuchsia-600",
  "bg-cyan-600",
  "bg-orange-600",
];

export function memberAvatarColor(memberId: string): string {
  let hash = 0;
  for (let i = 0; i < memberId.length; i++) {
    hash = (hash + memberId.charCodeAt(i) * (i + 1)) % AVATAR_HUES.length;
  }
  return AVATAR_HUES[hash] || AVATAR_HUES[0];
}

export function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

export function messageKindLabel(kind: ChatMessageKind): string | null {
  switch (kind) {
    case "member_sms":
      return "SMS";
    case "workout_update":
      return "Workout";
    case "youtube":
      return "YouTube";
    case "video_upload":
      return "Video";
    case "image":
      return "Photo";
    case "system":
      return "System";
    default:
      return null;
  }
}

/**
 * Bubble colors by message kind + author.
 * Layout convention: coach always left, members/group always right.
 */
export function bubbleColorsForMessage(
  kind: ChatMessageKind,
  authorRole: "coach" | "member" | "system" = "coach",
) {
  if (kind === "member_sms") return CHAT_KIND_COLORS.member_sms;
  if (kind === "workout_update") return CHAT_KIND_COLORS.workout_update;
  if (kind === "youtube") return CHAT_KIND_COLORS.youtube;
  if (kind === "video_upload") return CHAT_KIND_COLORS.video_upload;
  if (kind === "image") return CHAT_KIND_COLORS.image;
  if (kind === "system") return CHAT_KIND_COLORS.system;
  if (authorRole === "member") return CHAT_KIND_COLORS.member_text;
  return CHAT_KIND_COLORS.coach_text;
}
