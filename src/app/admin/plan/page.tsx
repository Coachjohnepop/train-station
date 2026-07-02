import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ date?: string }>;
};

/** Plan workout lives on Dashboard — keep old links working. */
export default async function AdminPlanPage({ searchParams }: Props) {
  const sp = await searchParams;
  const params = new URLSearchParams({ plan: "1" });
  if (sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date)) params.set("date", sp.date);
  redirect(`/admin/day?${params.toString()}`);
}