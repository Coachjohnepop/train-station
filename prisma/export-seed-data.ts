import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://user:pass@localhost:5432/db";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("[export-seed] Exporting current DB content to prisma/seed-data.json ...");

  const [
    subscriptionTiers,
    exercises,
    workouts,
    workoutExercises,
    programs,
    programWeeks,
    programDays,
    programDayOptions,
    equipment,
    userEquipment,
    liveSessions,
  ] = await Promise.all([
    prisma.subscriptionTier.findMany(),
    prisma.exercise.findMany(),
    prisma.workout.findMany(),
    prisma.workoutExercise.findMany(),
    prisma.program.findMany(),
    prisma.programWeek.findMany(),
    prisma.programDay.findMany(),
    prisma.programDayOption.findMany(),
    prisma.equipment.findMany(),
    prisma.userEquipment.findMany(),
    prisma.liveSession.findMany(),
  ]);

  const seedData = {
    _meta: {
      exportedAt: new Date().toISOString(),
      note: "Full content snapshot for initial platform deliverable (including hybrid Gym/Home day options, equipment catalog, and user home inventories). Use db:seed to restore. Editable via admin; can be cleared/reset for new customers.",
    },
    subscriptionTiers,
    exercises,
    workouts,
    workoutExercises,
    programs,
    programWeeks,
    programDays,
    programDayOptions,
    equipment,
    userEquipment,
    liveSessions,
  };

  const outPath = path.join(process.cwd(), "prisma", "seed-data.json");
  // backup previous if exists
  if (fs.existsSync(outPath)) {
    const backup = outPath + ".bak." + Date.now();
    fs.copyFileSync(outPath, backup);
    console.log("[export-seed] Previous seed backed up to", backup);
  }

  fs.writeFileSync(outPath, JSON.stringify(seedData, null, 2));
  console.log(
    `[export-seed] Exported ${exercises.length} exercises, ${workouts.length} workouts, ${programDays.length} program days, ${programDayOptions.length} day options, ${equipment.length} equipment items to ${outPath}`
  );
  console.log("[export-seed] This is now the base deliverable content.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
