"use client";

import { useMemo, useState } from "react";

export type LibraryExercise = {
  id: string;
  name: string;
  tags?: string | null;
};

export default function SearchableExerciseSelect({
  library,
  value,
  placeholder = "Search exercises…",
  onChange,
  disabled,
}: {
  library: LibraryExercise[];
  value: string;
  placeholder?: string;
  onChange: (exerciseId: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selected = library.find((e) => e.id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return library.slice(0, 12);
    return library
      .filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          (e.tags || "").toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [library, query]);

  return (
    <div className="relative">
      <input
        className="input w-full text-xs py-1.5"
        placeholder={selected ? selected.name : placeholder}
        value={open ? query : selected?.name || query}
        disabled={disabled}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg text-xs">
          {filtered.map((ex) => (
            <li key={ex.id}>
              <button
                type="button"
                className="w-full px-2 py-1.5 text-left hover:bg-[var(--surface-2)]"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(ex.id);
                  setQuery("");
                  setOpen(false);
                }}
              >
                {ex.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}