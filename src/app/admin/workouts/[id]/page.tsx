import WorkoutBuilder from "@/components/WorkoutBuilder";

type Props = { params: Promise<{ id: string }> };

export default async function WorkoutEditPage({ params }: Props) {
  const { id } = await params;
  return <WorkoutBuilder workoutId={id} />;
}