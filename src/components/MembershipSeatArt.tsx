import Image from "next/image";
import type { TicketTierId } from "@/lib/landing-tickets";
import {
  seatArtForPlan,
  seatArtForTicketId,
  type MembershipThemeTier,
} from "@/lib/membership-theme";
import type { SignupPlan } from "@/lib/signup-plans";

export default function MembershipSeatArt({
  ticketId,
  plan,
  membershipTier,
  alt,
  className = "",
  priority = false,
}: {
  ticketId?: TicketTierId;
  plan?: SignupPlan;
  membershipTier?: MembershipThemeTier;
  alt?: string;
  className?: string;
  priority?: boolean;
}) {
  const src =
    (ticketId ? seatArtForTicketId(ticketId) : null) ||
    (plan ? seatArtForPlan(plan) : null) ||
    (membershipTier
      ? seatArtForPlan(
          membershipTier === "member"
            ? "member"
            : membershipTier === "business"
              ? "business"
              : membershipTier === "pro"
                ? "pro"
                : "explorer",
        )
      : null);

  if (!src) return null;

  const label =
    alt ||
    (ticketId === "free"
      ? "Explorer free ticket seating"
      : ticketId === "coach-class"
        ? "Coach Class train seating"
        : ticketId === "business-class"
          ? "Business Class train seating"
          : ticketId === "first-class"
            ? "1st Class train seating"
            : "Train seating");

  return (
    <div className={`membership-seat-art ${className}`.trim()}>
      <Image
        src={src}
        alt={label}
        fill
        sizes="(max-width: 640px) 50vw, 25vw"
        className="object-cover"
        priority={priority}
      />
      <div className="membership-seat-art__shade" aria-hidden />
    </div>
  );
}