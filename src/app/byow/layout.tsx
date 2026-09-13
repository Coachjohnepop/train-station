import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bring Your Own Workout",
  robots: { index: false, follow: false },
};

export default function ByowLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell-bg min-h-screen text-[var(--text)]">
      <div className="mx-auto w-full max-w-lg px-4 py-8 md:max-w-2xl">{children}</div>
    </div>
  );
}
