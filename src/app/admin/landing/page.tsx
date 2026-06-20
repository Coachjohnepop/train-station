import AdminLandingMediaPanel from "@/components/AdminLandingMediaPanel";
import { getLandingMedia } from "@/lib/landing-media-store";

export const dynamic = "force-dynamic";

export default async function AdminLandingPage() {
  const config = await getLandingMedia();

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Landing videos</h1>
      <p className="mt-2 text-[var(--muted)]">
        Jeremy — paste your YouTube links here. They power the public home page welcome popover and
        the free-ticket modal.
      </p>
      <div className="mt-8">
        <AdminLandingMediaPanel
          initialWelcomeUrl={config.welcomeVideoUrl ?? ""}
          initialFreeUrl={config.freeChastiseVideoUrl ?? ""}
        />
      </div>
    </div>
  );
}