import { redirect } from "next/navigation";

/** Plan workout lives on Dashboard — keep old links working. */
export default function AdminPlanPage() {
  redirect("/admin/day?plan=1");
}