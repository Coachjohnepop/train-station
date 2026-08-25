"use client";

import {
  CHAD_KAITE_CLASS_EMAILS,
  JOHN_STEPH_CLASS_EMAILS,
  memberChipLabel,
  memberIdsForEmails,
} from "@/lib/coach-class-targets";

export type CoachMemberOption = { id: string; name: string; email?: string };

const DEMO_COUPLE_ID = "demo-user-john-steph";
const DEMO_CHAD_KAITE = ["demo-user-john", "demo-user-stephanie"];

export default function CoachMemberPicker({
  members,
  selectedIds,
  onChange,
  label = "Members",
  required = true,
}: {
  members: CoachMemberOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  label?: string;
  required?: boolean;
}) {
  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  function selectCouple() {
    const ids = memberIdsForEmails(members, JOHN_STEPH_CLASS_EMAILS);
    if (ids.length > 0) {
      onChange(ids);
      return;
    }
    if (members.some((m) => m.id === DEMO_COUPLE_ID)) onChange([DEMO_COUPLE_ID]);
  }

  function selectIndividuals() {
    const ids = memberIdsForEmails(members, CHAD_KAITE_CLASS_EMAILS);
    if (ids.length > 0) {
      onChange(ids);
      return;
    }
    const demo = DEMO_CHAD_KAITE.filter((id) => members.some((m) => m.id === id));
    if (demo.length) onChange(demo);
  }

  return (
    <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
      <p className="text-xs font-semibold text-accent">{label}</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">Quick picks</span>
        <button type="button" onClick={selectCouple} className="btn-ghost px-2.5 py-1 text-xs">
          John &amp; Steph
        </button>
        <button type="button" onClick={selectIndividuals} className="btn-ghost px-2.5 py-1 text-xs">
          Chad + Kaite
        </button>
        <button
          type="button"
          onClick={() => onChange(members.map((m) => m.id))}
          className="btn-ghost px-2.5 py-1 text-xs"
        >
          All students
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {members.map((m) => {
          const on = selectedIds.includes(m.id);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => toggle(m.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition border ${
                on
                  ? "border-accent bg-accent/20 text-accent"
                  : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--text)]"
              }`}
            >
              {on ? "✓ " : ""}
              {memberChipLabel(m, members)}
            </button>
          );
        })}
      </div>
      {selectedIds.length > 0 ? (
        <p className="text-[10px] text-[var(--success)]">
          {selectedIds.length} student{selectedIds.length !== 1 ? "s" : ""} selected
        </p>
      ) : required ? (
        <p className="text-[10px] text-amber-300">Pick at least one student — only they will see this workout.</p>
      ) : (
        <p className="text-[10px] text-[var(--muted)]">No SMS recipients — post still goes to the community feed.</p>
      )}
    </div>
  );
}