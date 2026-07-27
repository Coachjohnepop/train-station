import { redirect } from "next/navigation";

/** Friendly alias → Money desk (commission + balance + payment queue). */
export default function AdminPayoutsRedirectPage() {
  redirect("/admin/commission");
}
