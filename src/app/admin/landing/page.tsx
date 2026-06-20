import AdminLandingMediaPanel from "@/components/AdminLandingMediaPanel";

export const dynamic = "force-dynamic";

export default function AdminLandingPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Landing videos</h1>
      <p className="mt-2 text-[var(--muted)]">
        Jeremy — paste your YouTube links here. They power the public home page welcome popover and
        the free-ticket modal.
      </p>
      <div className="mt-8">
        <AdminLandingMediaPanel />
      </div>
    </div>
  );
}