import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

const CLASS = "btn-primary min-h-12 w-full";

/** One forward control for purchase + onboard. Same size, color, and label rhythm. */
export function NextStepButton({
  children = "Continue",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} {...props} className={`${CLASS} ${className}`.trim()}>
      {children}
    </button>
  );
}

export function NextStepLink({
  href,
  children = "Continue",
  className = "",
  onClick,
}: {
  href: string;
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Link href={href} onClick={onClick} className={`${CLASS} ${className}`.trim()}>
      {children}
    </Link>
  );
}
