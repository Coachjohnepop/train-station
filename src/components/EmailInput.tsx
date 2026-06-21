"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { filterEmailHistory, getLastEmail } from "@/lib/email-history";

type Variant = "default" | "signup";

const VARIANT_CLASS: Record<Variant, string> = {
  default: "input w-full",
  signup:
    "w-full rounded-full border border-[#3d2660] bg-[#0a0612] px-4 py-3 text-sm text-white placeholder:text-[#9d8ab8]",
};

export default function EmailInput({
  value,
  onChange,
  placeholder = "you@example.com",
  required,
  className = "",
  variant = "default",
  autoComplete = "email",
  prefillFromHistory = true,
  id,
  name = "email",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  variant?: Variant;
  autoComplete?: string;
  prefillFromHistory?: boolean;
  id?: string;
  name?: string;
}) {
  const autoId = useId();
  const inputId = id || autoId;
  const listId = `${inputId}-history`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const prefilled = useRef(false);

  useEffect(() => {
    setHistory(filterEmailHistory(""));
  }, []);

  useEffect(() => {
    if (!prefillFromHistory || prefilled.current || value.trim()) return;
    const last = getLastEmail();
    if (last) {
      prefilled.current = true;
      onChange(last);
    }
  }, [prefillFromHistory, value, onChange]);

  const suggestions = useMemo(() => filterEmailHistory(value), [value, history]);

  function refreshHistory() {
    setHistory(filterEmailHistory(""));
  }

  function pick(email: string) {
    onChange(email);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        id={inputId}
        name={name}
        type="email"
        list={listId}
        autoComplete={autoComplete}
        required={required}
        value={value}
        placeholder={placeholder}
        className={className || VARIANT_CLASS[variant]}
        onFocus={() => {
          refreshHistory();
          setOpen(true);
        }}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 160);
        }}
      />

      {/* Native datalist — helps Safari/Chrome autofill where allowed */}
      <datalist id={listId}>
        {history.map((email) => (
          <option key={email} value={email} />
        ))}
      </datalist>

      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          aria-label="Recent email addresses"
          className="absolute z-30 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg"
        >
          {suggestions.map((email) => (
            <li key={email}>
              <button
                type="button"
                role="option"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-[var(--surface-2)]"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(email)}
              >
                <span className="text-[var(--muted)]" aria-hidden>
                  ✉
                </span>
                <span className="truncate">{email}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export { rememberEmail } from "@/lib/email-history";