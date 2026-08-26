"use client";

import { useEffect, useState, type ReactNode } from "react";

/** iOS Safari bottom chrome sits on top of in-flow buttons. Keep the dock above it. */
export const PHONE_SAFARI_DOCK_PAD =
  "pb-[calc(env(safe-area-inset-bottom,0px)+4.5rem)] sm:pb-0";

const DOCK_CLASS = `sticky bottom-0 z-30 -mx-4 mt-2 space-y-2 border-t border-[var(--border)] bg-[var(--bg)]/95 px-4 pt-3 backdrop-blur sm:static sm:mx-0 sm:mt-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pt-0 sm:backdrop-blur-none ${PHONE_SAFARI_DOCK_PAD}`;

function isEditableTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/** Primary actions for member setup — stays above Safari’s toolbar on iPhone. */
export default function OnboardActionDock({ children }: { children: ReactNode }) {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      if (!isEditableTarget(e.target)) return;
      setKeyboardOpen(true);
      const node = e.target;
      window.setTimeout(() => {
        if (node instanceof HTMLElement) {
          node.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      }, 80);
    };
    const onFocusOut = () => {
      window.setTimeout(() => {
        if (!isEditableTarget(document.activeElement)) setKeyboardOpen(false);
      }, 60);
    };
    const vv = window.visualViewport;
    const onResize = () => {
      if (!vv) return;
      const covered = window.innerHeight - vv.height > 80;
      if (covered) setKeyboardOpen(true);
      else if (!isEditableTarget(document.activeElement)) setKeyboardOpen(false);
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    vv?.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      vv?.removeEventListener("resize", onResize);
    };
  }, []);

  if (keyboardOpen) return null;
  return <div className={DOCK_CLASS}>{children}</div>;
}
