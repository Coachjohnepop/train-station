import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createPgPool } from "../src/lib/pg-connection";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.vercel.production", override: true });

function resolveDatabaseUrl(): string {
  const postgres =
    process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL ?? "";
  const database = process.env.DATABASE_URL ?? "";
  const url =
    postgres || (database && !database.includes("dummy") ? database : "");
  if (!url || url.includes("dummy")) {
    throw new Error(
      "DATABASE_URL must be a real Postgres URL (vercel env pull .env.vercel.production)",
    );
  }
  return url;
}

const adapter = new PrismaPg(createPgPool(resolveDatabaseUrl()));
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
    userWeatherLogs,
    eatingApproaches,
    prompts,
    promptResponses,
    userMeasurements,
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
    prisma.userWeatherLog.findMany(),
    prisma.eatingApproach.findMany(),
    prisma.prompt.findMany(),
    prisma.promptResponse.findMany(),
    prisma.userMeasurement.findMany(),
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
    userWeatherLogs,
    eatingApproaches,
    prompts,
    promptResponses,
    userMeasurements,
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
    `[export-seed] Exported ${exercises.length} exercises, ${workouts.length} workouts, ${programDays.length} program days, ${programDayOptions.length} day options, ${equipment.length} equipment items, ${eatingApproaches.length} eating approaches, ${prompts.length} prompts, ${userMeasurements.length} measurements to ${outPath}`
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
