import AdminLandingMediaPanel from "@/components/AdminLandingMediaPanel";
import { getLandingMedia } from "@/lib/landing-media-store";

export const dynamic = "force-dynamic";

export default async function AdminLandingPage() {
  const config = await getLandingMedia();

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Landing media & payments</h1>
      <p className="mt-2 text-[var(--muted)]">
        Jeremy — paste YouTube links for the home page, and your Venmo QR for members who pay
        outside Stripe.
      </p>
      <div className="mt-8">
        <AdminLandingMediaPanel
          initialWelcomeUrl={config.welcomeVideoUrl ?? ""}
          initialFreeUrl={config.freeChastiseVideoUrl ?? ""}
          initialVenmoQrUrl={config.venmoQrUrl ?? ""}
          initialVenmoHandle={config.venmoHandle ?? ""}
          initialVenmoInstructions={config.venmoInstructions ?? ""}
        />
      </div>
    </div>
  );
}