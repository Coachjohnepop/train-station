import Link from "next/link";

export const dynamic = "force-dynamic";

const cards = [
  {
    href: "/admin/offers",
    title: "Offers & merchandise",
    description: "Custom training packages, merch SKUs, and coach-set pricing.",
    cta: "Manage offers →",
  },
  {
    href: "/admin/commission",
    title: "Payments & commission",
    description: "Stripe payouts, partner splits, referral discounts, Connect onboarding.",
    cta: "Open payments →",
  },
  {
    href: "/admin/users",
    title: "Users & roles",
    description: "Staff accounts, instructors, demo members, and role assignments.",
    cta: "Manage users →",
  },
  {
    href: "/admin/reports",
    title: "Reports",
    description: "Engagement and activity summaries across the site.",
    cta: "View reports →",
  },
  {
    href: "/admin/landing",
    title: "Landing & Venmo",
    description: "Public checkout backup — videos, Venmo QR, and ticket media.",
    cta: "Edit landing →",
  },
];

export default function PlatformAdminPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Platform admin</h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
        Site operations, payments, and access control — separate from Jeremy&apos;s day-to-day
        coaching tools.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="card flex flex-col justify-between transition hover:border-[#7c3aed]/50"
          >
            <div>
              <h2 className="font-semibold">{card.title}</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">{card.description}</p>
            </div>
            <span className="mt-4 text-sm font-medium text-[#7c3aed]">{card.cta}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}