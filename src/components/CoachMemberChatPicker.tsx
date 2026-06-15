"use client";

import type { MemberCoachingMode } from "@/lib/member-coaching-mode";
import { COACHING_MODE_LABELS } from "@/lib/member-coaching-mode";

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
};

const MODE_ORDER: MemberCoachingMode[] = ["live", "async"];

function MemberButton({
  member,
  active,
  onSelect,
  compact,
}: {
  member: CoachChatMember;
  active: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-lg text-left transition ${
        compact ? "px-3 py-1.5 text-xs font-medium" : "mb-1 w-full px-3 py-2.5"
      } ${
        active
          ? "bg-accent/15 font-medium text-accent ring-1 ring-accent/40"
          : compact
            ? "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--foreground)]"
            : "hover:bg-[var(--surface-2)]"
      }`}
    >
      <span className={compact ? "" : "block truncate text-sm font-medium"}>{member.name}</span>
      {!compact && member.preview && (
        <span className="mt-0.5 block truncate text-[10px] text-[var(--muted)]">{member.preview}</span>
      )}
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
}: {
  mode: MemberCoachingMode;
  members: CoachChatMember[];
  activeMemberId: string;
  onSelect: Props["onSelect"];
  layout: "sidebar" | "header";
  defaultOpen?: boolean;
}) {
  if (members.length === 0) return null;

  if (layout === "header") {
    return (
      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          {COACHING_MODE_LABELS[mode]}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {members.map((m) => (
            <MemberButton
              key={m.id}
              member={m}
              active={m.id === activeMemberId}
              compact
              onSelect={() => onSelect(m.id, m.threadId)}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <details className="group mb-2" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)] hover:text-[var(--foreground)]">
        <span className="text-accent group-open:rotate-90 transition-transform">▶</span>
        {COACHING_MODE_LABELS[mode]}
        <span className="text-[10px] font-normal normal-case">({members.length})</span>
      </summary>
      <div className="mt-1 px-1">
        {members.map((m) => (
          <MemberButton
            key={m.id}
            member={m}
            active={m.id === activeMemberId}
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
}: Props) {
  return (
    <div className={layout === "header" ? "space-y-3" : ""}>
      {MODE_ORDER.map((mode) => (
        <ModeGroup
          key={mode}
          mode={mode}
          members={members.filter((m) => m.coachingMode === mode)}
          activeMemberId={activeMemberId}
          onSelect={onSelect}
          layout={layout}
          defaultOpen
        />
      ))}
    </div>
  );
}