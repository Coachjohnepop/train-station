import AdminMemberCard from "@/components/AdminMemberCard";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ userId: string }> };

export default async function AdminMemberCardPage({ params }: Props) {
  const { userId } = await params;
  return <AdminMemberCard userId={decodeURIComponent(userId)} />;
}
