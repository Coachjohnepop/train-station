"use client";

/**
 * Phone input that always displays Train Station format: 916.284.1994
 */

import { formatPhoneInputValue } from "@/lib/sms-phone";

type Props = {
  value: string;
  onChange: (formatted: string) => void;
  onBlur?: () => void;
  name?: string;
  id?: string;
  placeholder?: string;
  className?: string;
  autoComplete?: string;
  disabled?: boolean;
  required?: boolean;
  "aria-label"?: string;
};

export default function PhoneInput({
  value,
  onChange,
  onBlur,
  name = "phone",
  id,
  placeholder = "916.284.1994",
  className = "input mt-1 w-full",
  autoComplete = "tel",
  disabled,
  required,
  "aria-label": ariaLabel,
}: Props) {
  return (
    <input
      type="tel"
      inputMode="tel"
      autoComplete={autoComplete}
      name={name}
      id={id}
      disabled={disabled}
      required={required}
      aria-label={ariaLabel}
      className={className}
      placeholder={placeholder}
      value={formatPhoneInputValue(value)}
      onChange={(e) => onChange(formatPhoneInputValue(e.target.value))}
      onBlur={onBlur}
    />
  );
}
