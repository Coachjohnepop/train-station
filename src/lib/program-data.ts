import { prisma } from "@/lib/prisma";

export async function listPrograms() {
  return prisma.program.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { weeks: true, enrollments: true } },
      weeks: {
        include: {
          days: {
            select: { workoutId: true },
          },
        },
      },
    },
  });
}

export async function getProgramBySlug(slug: string) {
  return prisma.program.findUnique({
    where: { slug },
    include: {
      weeks: {
        orderBy: { weekNumber: "asc" },
        include: {
          days: {
            orderBy: { dayNumber: "asc" },
            include: { workout: true },
          },
        },
      },
      _count: { select: { enrollments: true } },
    },
  });
}