import { redirect } from "next/navigation";

/** Friendly alias → Stripe money Share tab (partner pool + bank history). */
export default function AdminPayoutsRedirectPage() {
  redirect("/admin/billing?tab=share");
}
