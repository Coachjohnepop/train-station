import type { ReactNode } from "react";

/** iOS Safari bottom chrome sits on top of in-flow buttons. Keep the dock above it. */
export const PHONE_SAFARI_DOCK_PAD =
  "pb-[calc(env(safe-area-inset-bottom,0px)+4.5rem)] sm:pb-0";

const DOCK_CLASS = `sticky bottom-0 z-30 -mx-4 mt-2 space-y-2 border-t border-[var(--border)] bg-[var(--bg)]/95 px-4 pt-3 backdrop-blur sm:static sm:mx-0 sm:mt-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pt-0 sm:backdrop-blur-none ${PHONE_SAFARI_DOCK_PAD}`;

/** Primary actions for member setup — stays above Safari’s toolbar on iPhone. */
export default function OnboardActionDock({ children }: { children: ReactNode }) {
  return <div className={DOCK_CLASS}>{children}</div>;
}
