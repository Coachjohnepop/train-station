"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import TrainStationBrand from "@/components/TrainStationBrand";
import { goMemberTodayHome } from "@/lib/member-today-home";

export default function MemberHeaderHomeLink() {
  const router = useRouter();

  return (
    <Link
      href="/member/today"
      className="transition hover:opacity-90"
      title="Home — Today"
      onClick={(e) => {
        e.preventDefault();
        goMemberTodayHome(router);
      }}
    >
      <TrainStationBrand variant="header" className="!h-7 sm:!h-8" />
    </Link>
  );
}