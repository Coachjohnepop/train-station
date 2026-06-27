"use client";

import { useState } from "react";

type Variant = "default" | "signup";

const VARIANT_CLASS: Record<Variant, string> = {
  default: "input pr-11 w-full",
  signup:
    "w-full rounded-full border border-[#3d2660] bg-[#0a0612] px-4 py-3 pr-11 text-sm text-white placeholder:text-[#9d8ab8]",
};

const TOGGLE_CLASS: Record<Variant, string> = {
  default: "text-[var(--muted)] hover:text-[var(--foreground)]",
  signup: "text-[#9d8ab8] hover:text-white",
};

type PasswordInputProps = {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
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
  autoComplete = "new-password",
  required,
  minLength,
  variant = "default",
  className = "",
  wrapperClassName = "",
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const inputClass = [VARIANT_CLASS[variant], className].filter(Boolean).join(" ");

  return (
    <div className={["relative", wrapperClassName].filter(Boolean).join(" ")}>
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
        placeholder={placeholder}
      />
      <button
        type="button"
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