"use client";

import { CHECKOUT_FULFILLMENT_OPTIONS } from "@/lib/checkout-fulfillment";

type FulfillmentChoice = {
  id: string;
  label: string;
  addressLines: string[];
  hint: string;
};

export default function CheckoutFulfillmentPicker({
  value,
  onChange,
  options = CHECKOUT_FULFILLMENT_OPTIONS,
}: {
  value: string;
  onChange: (id: string) => void;
  options?: FulfillmentChoice[];
}) {
  return (
    <fieldset className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
      <legend className="px-0.5 text-xs font-semibold text-[var(--text)]">How you get it</legend>
      <div className="space-y-2">
        {options.map((option) => {
          const selected = value === option.id;
          return (
            <label
              key={option.id}
              className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition ${
                selected
                  ? "border-accent bg-accent/10"
                  : "border-[var(--border)] bg-[var(--surface)]"
              }`}
            >
              <input
                type="radio"
                name="checkout-fulfillment"
                className="mt-1 accent-[var(--accent)]"
                checked={selected}
                onChange={() => onChange(option.id)}
              />
              <span>
                <span className="block text-sm font-semibold">{option.label}</span>
                {option.addressLines.map((line) => (
                  <span key={line} className="block text-xs text-[var(--muted)]">
                    {line}
                  </span>
                ))}
                <span className="mt-1 block text-[11px] text-[var(--muted)]">{option.hint}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
