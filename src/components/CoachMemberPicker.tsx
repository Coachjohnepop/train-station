"use client";

export type CoachMemberOption = { id: string; name: string };

const JOHN_STEPHANIE = ["demo-user-john", "demo-user-stephanie"];

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

  function selectJohnStephanie() {
    const ids = JOHN_STEPHANIE.filter((id) => members.some((m) => m.id === id));
    onChange(ids.length ? ids : selectedIds);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-[var(--muted)]">Assign to members</span>
        <button type="button" onClick={selectJohnStephanie} className="btn-ghost px-2 py-0.5 text-[10px]">
          John + Stephanie
        </button>
      </div>
      <div className="flex flex-wrap gap-3">
        {members.map((m) => (
          <label key={m.id} className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input type="checkbox" checked={selectedIds.includes(m.id)} onChange={() => toggle(m.id)} />
            {m.name}
          </label>
        ))}
      </div>
      {selectedIds.length === 0 && (
        <p className="text-[10px] text-amber-300">Pick at least one member — only they will see this workout.</p>
      )}
    </div>
  );
}