"use client";

import type { MemberCoachingMode } from "@/lib/member-coaching-mode";
import { COACHING_MODE_LABELS } from "@/lib/member-coaching-mode";
import {
  CHAT_MODE_COLORS,
  memberAvatarColor,
  memberInitials,
} from "@/lib/chat-colors";

export type CoachChatMember = {
  id: string;
  name: string;
  coachingMode: MemberCoachingMode;
  threadId?: string;
  preview?: string;
};

type Props = {
  members: CoachChatMember[];
  activeMemberId: string;
  onSelect: (memberId: string, threadId?: string) => void;
  layout?: "sidebar" | "header";
  unreadByThread?: Record<string, number>;
};

const MODE_ORDER: MemberCoachingMode[] = ["live", "async"];

function MemberButton({
  member,
  active,
  onSelect,
  compact,
  unread = 0,
}: {
  member: CoachChatMember;
  active: boolean;
  onSelect: () => void;
  compact?: boolean;
  unread?: number;
}) {
  const modeColors = CHAT_MODE_COLORS[member.coachingMode];
  const avatarBg = memberAvatarColor(member.id);

  if (compact) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
          active
            ? `${modeColors.chip} ring-1 ${modeColors.chipText}`
            : "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--foreground)]"
        }`}
      >
        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-[var(--text)] ${avatarBg}`}>
          {memberInitials(member.name)}
        </span>
        {member.name.split(" ")[0]}
        {unread > 0 ? (
          <span className="rounded-full bg-[#ff3b30] px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm ring-1 ring-white/30">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative mb-1.5 flex w-full min-h-[52px] items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
        active
          ? `${modeColors.section} ring-1 ring-inset`
          : unread > 0
            ? "bg-rose-500/5 ring-1 ring-inset ring-rose-500/25 hover:bg-rose-500/10"
            : "hover:bg-[var(--surface-2)]"
      }`}
    >
      <span
        className={`absolute left-0 top-2 bottom-2 w-1 rounded-full ${
          unread > 0 ? "bg-[#ff3b30] opacity-100" : modeColors.stripe
        } ${active || unread > 0 ? "opacity-100" : "opacity-40"}`}
      />
      <span
        className={`relative ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-[var(--text)] ${avatarBg}`}
      >
        {memberInitials(member.name)}
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#ff3b30] px-1 text-[9px] font-bold text-white ring-2 ring-[var(--surface)]">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={`truncate text-sm font-semibold ${unread > 0 ? "text-[var(--text)]" : ""}`}>
            {member.name}
          </span>
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ring-1 ${modeColors.chip} ${modeColors.chipText}`}
          >
            {modeColors.label}
          </span>
        </span>
        {member.preview && (
          <span
            className={`mt-0.5 block truncate text-[11px] ${
              unread > 0 ? "font-medium text-[var(--text)]/80" : "text-[var(--muted)]"
            }`}
          >
            {member.preview}
          </span>
        )}
      </span>
      {unread > 0 ? (
        <span className="flex h-6 min-w-[24px] shrink-0 items-center justify-center rounded-full bg-[#ff3b30] px-1.5 text-[11px] font-bold text-white shadow-sm">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </button>
  );
}

function ModeGroup({
  mode,
  members,
  activeMemberId,
  onSelect,
  layout,
  defaultOpen,
  unreadByThread = {},
}: {
  mode: MemberCoachingMode;
  members: CoachChatMember[];
  activeMemberId: string;
  onSelect: Props["onSelect"];
  layout: "sidebar" | "header";
  defaultOpen?: boolean;
  unreadByThread?: Record<string, number>;
}) {
  const modeColors = CHAT_MODE_COLORS[mode];
  if (members.length === 0) return null;

  if (layout === "header") {
    return (
      <div className={`rounded-lg border px-2 py-2 ${modeColors.section}`}>
        <p className={`mb-1.5 text-[10px] font-bold uppercase tracking-wide ${modeColors.chipText}`}>
          {COACHING_MODE_LABELS[mode]}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {members.map((m) => (
            <MemberButton
              key={m.id}
              member={m}
              active={m.id === activeMemberId}
              compact
              unread={m.threadId ? unreadByThread[m.threadId] || 0 : 0}
              onSelect={() => onSelect(m.id, m.threadId)}
            />
          ))}
        </div>
      </div>
    );
  }

  const sectionUnread = members.reduce(
    (n, m) => n + (m.threadId ? unreadByThread[m.threadId] || 0 : 0),
    0,
  );

  return (
    <details className="group mb-2" open={defaultOpen}>
      <summary
        className={`flex cursor-pointer list-none items-center gap-2 rounded-lg border px-2 py-2 text-xs font-bold uppercase tracking-wide ${modeColors.section} ${modeColors.chipText}`}
      >
        <span className="transition-transform group-open:rotate-90">▶</span>
        {COACHING_MODE_LABELS[mode]}
        <span className="text-[10px] font-normal normal-case text-[var(--muted)]">({members.length})</span>
        {sectionUnread > 0 && (
          <span className="ml-auto rounded-full bg-rose-500 px-2 py-0.5 text-[9px] font-bold text-white">
            {sectionUnread}
          </span>
        )}
      </summary>
      <div className="mt-1 px-0.5">
        {members.map((m) => (
          <MemberButton
            key={m.id}
            member={m}
            active={m.id === activeMemberId}
            unread={m.threadId ? unreadByThread[m.threadId] || 0 : 0}
            onSelect={() => onSelect(m.id, m.threadId)}
          />
        ))}
      </div>
    </details>
  );
}

export default function CoachMemberChatPicker({
  members,
  activeMemberId,
  onSelect,
  layout = "sidebar",
  unreadByThread = {},
}: Props) {
  return (
    <div className={layout === "header" ? "flex flex-wrap gap-2" : ""}>
      {MODE_ORDER.map((mode) => (
        <ModeGroup
          key={mode}
          mode={mode}
          members={members.filter((m) => m.coachingMode === mode)}
          activeMemberId={activeMemberId}
          onSelect={onSelect}
          layout={layout}
          defaultOpen
          unreadByThread={unreadByThread}
        />
      ))}
    </div>
  );
}