"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { useRouter } from "next/navigation";
import {
  searchAdminApps,
  type AdminSearchItem,
} from "@/lib/admin-app-search-index";

type Props = {
  canCoach: boolean;
  canPlatform: boolean;
  onNavigate?: () => void;
  collapsed?: boolean;
  /** Sticky top bar layout (wider input, stronger chrome). */
  variant?: "sidebar" | "topbar";
  /** Only one instance should own ⌘K (default true). */
  enableHotkey?: boolean;
};

export default function AdminAppSearch({
  canCoach,
  canPlatform,
  onNavigate,
  collapsed = false,
  variant = "sidebar",
  enableHotkey = true,
}: Props) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const scope = useMemo(
    () => ({ canCoach, canPlatform }),
    [canCoach, canPlatform],
  );

  const results = useMemo(
    () => searchAdminApps(query, scope, 14),
    [query, scope],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open, paletteOpen]);

  const go = useCallback(
    (item: AdminSearchItem) => {
      setQuery("");
      setOpen(false);
      setPaletteOpen(false);
      onNavigate?.();
      router.push(item.href);
    },
    [onNavigate, router],
  );

  // Global ⌘K / Ctrl+K (only one mounted instance should enable this)
  useEffect(() => {
    if (!enableHotkey) return;
    function onKey(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setPaletteOpen(true);
        setOpen(true);
        window.setTimeout(() => inputRef.current?.focus(), 0);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enableHotkey]);

  // Click outside closes dropdown (sidebar mode)
  useEffect(() => {
    if (!open || paletteOpen) return;
    function onPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open, paletteOpen]);

  useEffect(() => {
    if (!paletteOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setPaletteOpen(false);
        setOpen(false);
        setQuery("");
      }
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [paletteOpen]);

  function onInputKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[activeIndex];
      if (item) go(item);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setPaletteOpen(false);
      setQuery("");
      inputRef.current?.blur();
    }
  }

  const showResults = open || paletteOpen;

  const resultsList = (
    <ul
      id={listId}
      role="listbox"
      className="max-h-[min(60vh,22rem)] overflow-y-auto py-1"
    >
      {results.length === 0 ? (
        <li className="px-3 py-4 text-center text-xs text-[var(--muted)]">
          No matches for “{query.trim()}”
        </li>
      ) : (
        results.map((item, index) => {
          const active = index === activeIndex;
          return (
            <li key={item.id} role="option" aria-selected={active}>
              <button
                type="button"
                className={`flex w-full flex-col gap-0.5 px-3 py-2.5 text-left transition ${
                  active
                    ? "bg-accent/15 text-[var(--text)]"
                    : "text-[var(--text)] hover:bg-[var(--surface-2)]"
                }`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => go(item)}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{item.title}</span>
                  <span className="shrink-0 rounded-full bg-[var(--surface-2)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                    {item.group}
                  </span>
                </span>
                <span className="text-[11px] leading-snug text-[var(--muted)]">
                  {item.description}
                </span>
              </button>
            </li>
          );
        })
      )}
    </ul>
  );

  if (collapsed) {
    return (
      <>
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-sm text-[var(--muted)] transition hover:border-accent hover:text-accent"
          title="Search apps (⌘K)"
          aria-label="Search apps and pages"
          onClick={() => {
            setPaletteOpen(true);
            setOpen(true);
            window.setTimeout(() => inputRef.current?.focus(), 0);
          }}
        >
          ⌕
        </button>
        {paletteOpen ? (
          <SearchPalette
            inputRef={inputRef}
            listId={listId}
            query={query}
            setQuery={setQuery}
            setOpen={setOpen}
            onInputKeyDown={onInputKeyDown}
            onClose={() => {
              setPaletteOpen(false);
              setOpen(false);
              setQuery("");
            }}
            resultsList={resultsList}
          />
        ) : null}
      </>
    );
  }

  const isTopbar = variant === "topbar";

  return (
    <div ref={rootRef} className={`relative ${isTopbar ? "w-full min-w-0" : "px-1"}`}>
      <label className="sr-only" htmlFor={`${listId}-input`}>
        Search apps and pages
      </label>
      <div className="relative">
        <span
          className={`pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] ${
            isTopbar ? "text-sm" : "text-xs"
          }`}
          aria-hidden
        >
          ⌕
        </span>
        <input
          id={`${listId}-input`}
          ref={inputRef}
          type="search"
          autoComplete="off"
          spellCheck={false}
          placeholder={
            isTopbar
              ? "Search apps & pages — Discount codes, Programs, Members…"
              : "Search apps…"
          }
          value={query}
          aria-controls={listId}
          aria-expanded={showResults}
          aria-autocomplete="list"
          role="combobox"
          className={`input w-full pl-8 pr-12 ${
            isTopbar ? "py-2.5 text-sm shadow-sm" : "py-2 text-xs"
          }`}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onInputKeyDown}
        />
        <kbd
          className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 font-medium text-[var(--muted)] ${
            isTopbar
              ? "hidden text-[10px] sm:inline"
              : "hidden text-[9px] sm:inline"
          }`}
        >
          ⌘K
        </kbd>
      </div>
      {showResults && !paletteOpen ? (
        <div
          className={`absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-xl ${
            isTopbar ? "max-w-2xl" : ""
          }`}
        >
          {resultsList}
        </div>
      ) : null}
      {paletteOpen ? (
        <SearchPalette
          inputRef={inputRef}
          listId={listId}
          query={query}
          setQuery={setQuery}
          setOpen={setOpen}
          onInputKeyDown={onInputKeyDown}
          onClose={() => {
            setPaletteOpen(false);
            setOpen(false);
            setQuery("");
          }}
          resultsList={resultsList}
        />
      ) : null}
    </div>
  );
}

function SearchPalette({
  inputRef,
  listId,
  query,
  setQuery,
  setOpen,
  onInputKeyDown,
  onClose,
  resultsList,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  listId: string;
  query: string;
  setQuery: (q: string) => void;
  setOpen: (o: boolean) => void;
  onInputKeyDown: (e: ReactKeyboardEvent<HTMLInputElement>) => void;
  onClose: () => void;
  resultsList: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Search apps">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close search"
        onClick={onClose}
      />
      <div className="absolute left-1/2 top-[12vh] w-[min(100%-1.5rem,28rem)] -translate-x-1/2 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg)] shadow-2xl">
        <div className="border-b border-[var(--border)] p-3">
          <div className="relative">
            <span
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)]"
              aria-hidden
            >
              ⌕
            </span>
            <input
              ref={inputRef}
              type="search"
              autoComplete="off"
              spellCheck={false}
              autoFocus
              placeholder="Search apps & pages…"
              value={query}
              aria-controls={listId}
              aria-expanded
              aria-autocomplete="list"
              role="combobox"
              className="input w-full py-2.5 pl-9 pr-3 text-sm"
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onKeyDown={onInputKeyDown}
            />
          </div>
          <p className="mt-2 text-[10px] text-[var(--muted)]">
            Jump to coach tools, billing, discounts, member surfaces… Esc to close
          </p>
        </div>
        {resultsList}
      </div>
    </div>
  );
}
