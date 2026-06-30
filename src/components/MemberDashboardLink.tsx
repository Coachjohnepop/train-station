"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { defaultMemberResumePath, resolveMemberDashboardHref } from "@/lib/resume-path";

/** Open Dashboard — jumps to last member page or Today (avoids brittle /member hop). */
export default function MemberDashboardLink({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const [href, setHref] = useState(defaultMemberResumePath());

  useEffect(() => {
    setHref(resolveMemberDashboardHref());
  }, []);

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}