import { notFound } from "next/navigation";
import { getMemberDashboard } from "@/lib/member-context";
import ProgramCatalog from "@/components/ProgramCatalog";

export const dynamic = "force-dynamic";

export default async function MemberProgramsPage() {
  const data = await getMemberDashboard();
  if (!data) notFound();

  const enrolledSlugs = data.enrollments.map((e) => e.program.slug);

  return (
    <ProgramCatalog
      programs={data.programs.map((p: (typeof data.programs)[number]) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description,
        category: p.category,
        tierSlug: p.tierSlug,
        workoutCount: p.workoutCount,
        catalogStatus: p.catalogStatus,
      }))}
      enrolledSlugs={enrolledSlugs}
    />
  );
}