import { defaultMemberResumePath } from "@/lib/resume-path";

/** Open Dashboard — full page load to Today (avoids mobile Safari RSC nav failures). */
export default function MemberDashboardLink({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a href={defaultMemberResumePath()} className={className}>
      {children}
    </a>
  );
}