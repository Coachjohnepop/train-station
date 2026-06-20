import Link from "next/link";
import AdminNav from "@/components/AdminNav";
import DevModeSwitcher from "@/components/DevModeSwitcher";
import LogoutButton from "@/components/LogoutButton";
import { getSessionUser } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionUser();

  return (
    <div className="app-shell-bg flex min-h-screen flex-col">
      <DevModeSwitcher active="admin" staffSession={session} />
      <header className="app-shell-header">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link href="/admin" className="text-sm font-semibold tracking-tight text-[var(--foreground)] hover:text-[var(--accent)]">
                The Train Station
              </Link>
              <div>
                <p className="text-sm font-medium">{session?.name || "Coach"}</p>
                <p className="text-[10px] text-[var(--muted)]">{session?.email}</p>
              </div>
            </div>
            <LogoutButton />
          </div>
          <div className="overflow-x-auto pb-1">
            <AdminNav />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {children}
      </main>
    </div>
  );
}