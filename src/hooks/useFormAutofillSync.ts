"use client";

import { useEffect, useRef, type RefObject } from "react";

/** Sync browser autofill into React state (controlled inputs miss autofill otherwise). */
export function useFormAutofillSync(
  formRef: RefObject<HTMLFormElement | null>,
  fieldNames: string[],
  onSync: (values: Record<string, string>) => void,
) {
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;
  const fieldsKey = fieldNames.join("\0");

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    const syncFromDom = () => {
      const values: Record<string, string> = {};
      for (const name of fieldNames) {
        const el = form.elements.namedItem(name);
        if (!(el instanceof HTMLInputElement)) continue;
        if (el.value) values[name] = el.value;
      }
      if (Object.keys(values).length > 0) onSyncRef.current(values);
    };

    const onAnimation = (event: Event) => {
      const name = (event as AnimationEvent).animationName || "";
      if (name.includes("AutoFill") || name === "onAutoFillStart") {
        syncFromDom();
      }
    };

    form.addEventListener("input", syncFromDom);
    form.addEventListener("change", syncFromDom);
    const inputs = form.querySelectorAll("input");
    inputs.forEach((input) => input.addEventListener("animationstart", onAnimation));

    return () => {
      form.removeEventListener("input", syncFromDom);
      form.removeEventListener("change", syncFromDom);
      inputs.forEach((input) => input.removeEventListener("animationstart", onAnimation));
    };
  }, [formRef, fieldsKey, fieldNames]);
}