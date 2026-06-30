import Link from "next/link";
import { defaultMemberResumePath } from "@/lib/resume-path";

/** Open Dashboard — always lands on Today (resume path is for in-app reopen only). */
export default function MemberDashboardLink({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={defaultMemberResumePath()} className={className}>
      {children}
    </Link>
  );
}