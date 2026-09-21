import type { Metadata } from "next";
import ForcedLandingPage from "@/components/ForcedLandingPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Landing B · First Day Free",
  robots: { index: false, follow: false },
};

export default function LandingBPage() {
  return <ForcedLandingPage variant="jeremy" />;
}
