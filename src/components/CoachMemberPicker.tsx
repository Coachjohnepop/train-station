"use client";

export type CoachMemberOption = { id: string; name: string };

const JOHN_STEPH_COUPLE = "demo-user-john-steph";
const JOHN_STEPHANIE_INDIVIDUALS = ["demo-user-john", "demo-user-stephanie"];

export default function CoachMemberPicker({
  members,
  selectedIds,
  onChange,
}: {
  members: CoachMemberOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  function selectJohnStephCouple() {
    if (members.some((m) => m.id === JOHN_STEPH_COUPLE)) {
      onChange([JOHN_STEPH_COUPLE]);
    }
  }

  function selectJohnStephanieIndividuals() {
    const ids = JOHN_STEPHANIE_INDIVIDUALS.filter((id) => members.some((m) => m.id === id));
    onChange(ids.length ? ids : selectedIds);
  }

  return (
    <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-accent">Quick picks</span>
        <button type="button" onClick={selectJohnStephCouple} className="btn-ghost px-2.5 py-1 text-xs">
          John &amp; Steph
        </button>
        <button type="button" onClick={selectJohnStephanieIndividuals} className="btn-ghost px-2.5 py-1 text-xs">
          John + Stephanie
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
                  : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] hover:text-white"
              }`}
            >
              {on ? "✓ " : ""}
              {m.name}
            </button>
          );
        })}
      </div>
      {selectedIds.length > 0 ? (
        <p className="text-[10px] text-[var(--success)]">
          {selectedIds.length} student{selectedIds.length !== 1 ? "s" : ""} selected
        </p>
      ) : (
        <p className="text-[10px] text-amber-300">Pick at least one student — only they will see this workout.</p>
      )}
    </div>
  );
}