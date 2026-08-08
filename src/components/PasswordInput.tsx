"use client";

import { useState } from "react";

type Variant = "default" | "signup";

export type PasswordPurpose = "new" | "confirm" | "current";

const VARIANT_CLASS: Record<Variant, string> = {
  default: "input pr-11 w-full",
  signup:
    "w-full rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 py-3 pr-11 text-sm text-[var(--text)] placeholder:text-[var(--muted)]",
};

const TOGGLE_CLASS: Record<Variant, string> = {
  default: "text-[var(--muted)] hover:text-[var(--foreground)]",
  signup: "text-[var(--muted)] hover:text-[var(--text)]",
};

const PURPOSE_AUTOCOMPLETE: Record<PasswordPurpose, string> = {
  new: "new-password",
  // Let the primary field own strong-password suggestion (Chrome/Safari/Firefox).
  confirm: "off",
  current: "current-password",
};

/** iOS Keychain + Safari strong-password hints */
const NEW_PASSWORD_RULES = "minlength: 8; required: lower; required: upper; required: digit;";

type PasswordInputProps = {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  purpose?: PasswordPurpose;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  variant?: Variant;
  className?: string;
  wrapperClassName?: string;
};

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
          stroke="currentColor"
          strokeWidth="1.75"
        />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export default function PasswordInput({
  id,
  name,
  value,
  onChange,
  placeholder,
  purpose = "new",
  autoComplete,
  required,
  minLength,
  variant = "default",
  className = "",
  wrapperClassName = "",
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  // Browsers skip strong-password UI on controlled fields until the user focuses.
  const [unlocked, setUnlocked] = useState(purpose !== "new");
  const inputClass = [VARIANT_CLASS[variant], className].filter(Boolean).join(" ");
  const resolvedAutoComplete = autoComplete ?? PURPOSE_AUTOCOMPLETE[purpose];

  function unlock() {
    if (!unlocked) setUnlocked(true);
  }

  return (
    <div className={["relative", wrapperClassName].filter(Boolean).join(" ")}>
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={resolvedAutoComplete}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        required={required}
        minLength={minLength}
        value={value}
        readOnly={purpose === "new" && !unlocked}
        onFocus={unlock}
        onClick={unlock}
        onChange={(e) => {
          unlock();
          onChange(e.target.value);
        }}
        className={inputClass}
        placeholder={placeholder}
        {...(purpose === "new"
          ? { passwordRules: NEW_PASSWORD_RULES }
          : {})}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        className={[
          "absolute right-3 top-1/2 -translate-y-1/2 transition",
          TOGGLE_CLASS[variant],
        ].join(" ")}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        <EyeIcon open={visible} />
      </button>
    </div>
  );
}