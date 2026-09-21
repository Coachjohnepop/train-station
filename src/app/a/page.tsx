import type { Metadata } from "next";
import ForcedLandingPage from "@/components/ForcedLandingPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Landing A · Grab Your Ticket",
  robots: { index: false, follow: false },
};

export default function LandingAPage() {
  return <ForcedLandingPage variant="tour" />;
}
