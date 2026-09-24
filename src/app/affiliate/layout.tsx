import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Affiliate",
  description: "The Train Station affiliate sign-in.",
  robots: { index: false, follow: false, nocache: true },
};

export default function AffiliateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
