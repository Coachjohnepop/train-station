"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import TrainStationBrand from "@/components/TrainStationBrand";
import { goMemberTodayHome } from "@/lib/member-today-home";

export default function MemberHeaderHomeLink({ setupHref }: { setupHref?: string }) {
  const router = useRouter();
  const href = setupHref || "/member/today";

  return (
    <Link
      href={href}
      className="transition hover:opacity-90"
      aria-label={setupHref ? "Continue setup" : "Home"}
      title={setupHref ? "Continue setup" : "Home"}
      onClick={(e) => {
        if (setupHref) return;
        e.preventDefault();
        goMemberTodayHome(router);
      }}
    >
      <TrainStationBrand variant="header" className="!h-7 sm:!h-8" />
    </Link>
  );
}