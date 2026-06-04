import Link from "next/link";
import AdminNav from "@/components/AdminNav";
import DevModeSwitcher from "@/components/DevModeSwitcher";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app-shell-bg flex min-h-screen flex-col">
      <DevModeSwitcher active="admin" />
      <header className="app-shell-header">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <img
                src="/images/logo-icon.png"
                alt="The Train Station"
                className="h-11 w-auto"
              />
            </Link>
            <p className="text-sm text-[var(--muted)]">Coach admin</p>
          </div>
          <AdminNav />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {children}
      </main>
    </div>
  );
}