import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { TOP_LEVEL_PROGRAMS } from "../src/lib/programs";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://user:pass@localhost:5432/db";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.subscriptionTier.upsert({
    where: { slug: "coach" },
    update: {},
    create: {
      slug: "coach",
      name: "Coach",
      monthlyCents: 0,
    },
  });

  await prisma.subscriptionTier.upsert({
    where: { slug: "first_class" },
    update: {},
    create: {
      slug: "first_class",
      name: "1st Class",
      monthlyCents: 1900,
    },
  });

  for (const track of TOP_LEVEL_PROGRAMS) {
    const published = track.catalogStatus === "live";
    await prisma.program.upsert({
      where: { slug: track.slug },
      update: {
        name: track.name,
        description: track.description,
        sortOrder: track.sortOrder,
        category: track.category,
        published,
      },
      create: {
        slug: track.slug,
        name: track.name,
        description: track.description,
        sortOrder: track.sortOrder,
        category: track.category,
        published,
        tierSlug: "coach",
        durationWeeks: 4,
      },
    });
  }

  // --- Full content + schedule replay from previous SQLite export ---
  // This restores the exact 28-day Adult (and other) scheduled workouts/exercises
  // that were built via admin + ingest. IDs are preserved so sample logs etc attach.
  const seedDataPath = path.join(process.cwd(), "prisma", "seed-data.json");
  if (fs.existsSync(seedDataPath)) {
    const { importCatalogSnapshot } = await import("../src/lib/import-catalog-snapshot");
    const seedData = JSON.parse(fs.readFileSync(seedDataPath, "utf8"));
    console.log("[seed] Importing from seed-data.json (exercises, workouts, schedule)...");
    const result = await importCatalogSnapshot(prisma, seedData, "seed-data.json");
    console.log(
      `[seed] Imported ${result.exercises} exercises, ${result.workouts} workouts, ${result.programDays} program days, ${result.programDayOptions} day options, ${result.equipment} equipment items.`,
    );
  } else {
    console.log("[seed] No prisma/seed-data.json — schedule will be minimal (run export script while sqlite data exists).");
  }

  const demoUser = await prisma.user.upsert({
    where: { email: "demo@thetrainstation.co" },
    update: { name: "Alex", phone: "(555) 987-6543", dailyReminderTime: "07:30", city: "Austin", state: "TX" },
    create: {
      email: "demo@thetrainstation.co",
      name: "Alex",
      phone: "(555) 987-6543",
      dailyReminderTime: "07:30",
      city: "Austin",
      state: "TX",
      role: "MEMBER",
    },
  });

  const firstClass = await prisma.subscriptionTier.findUnique({
    where: { slug: "first_class" },
  });
  if (firstClass) {
    const existingSub = await prisma.subscription.findFirst({
      where: { userId: demoUser.id, tierId: firstClass.id },
    });
    if (!existingSub) {
      await prisma.subscription.create({
        data: {
          userId: demoUser.id,
          tierId: firstClass.id,
          status: "active",
        },
      });
    }
  }

  const adultProgram = await prisma.program.findUnique({
    where: { slug: "adult" },
  });
  if (adultProgram) {
    const existingEnroll = await prisma.programEnrollment.findFirst({
      where: { userId: demoUser.id, programId: adultProgram.id },
    });
    if (!existingEnroll) {
      await prisma.programEnrollment.create({
        data: {
          userId: demoUser.id,
          programId: adultProgram.id,
          currentWeek: 1,
          currentDay: 1,
        },
      });
    }
  }

  let demoWorkout = await prisma.workout.findFirst({
    where: { name: "Preview: Upper Body Power" },
  });
  if (!demoWorkout) {
    demoWorkout = await prisma.workout.create({
      data: { name: "Preview: Upper Body Power" },
    });
  }

  // Find key exercises by name (now come from the full import above)
  const squat = await prisma.exercise.findFirst({ where: { name: "Back Squat" } });
  const bench = await prisma.exercise.findFirst({ where: { name: "Bench Press" } });
  const pull = await prisma.exercise.findFirst({ where: { name: "Pull-Up" } });
  const rdl = await prisma.exercise.findFirst({ where: { name: "Romanian Deadlift" } });

  const demoItems = [
    {
      exerciseId: bench!.id,
      sortOrder: 0,
      setScheme: "standard",
      repPattern: null,
      reps: "20",
      sets: 2,
      weightTier: "medium",
      notes: "2 sets of 20 reps — controlled tempo on the way down.",
    },
    {
      exerciseId: rdl!.id,
      sortOrder: 1,
      setScheme: "drop_sets",
      repPattern: "rep_6_8_10",
      reps: null,
      sets: 4,
      weightTier: "medium",
    },
    {
      exerciseId: pull!.id,
      sortOrder: 2,
      setScheme: "rest_pause",
      repPattern: "count_3_7",
      reps: null,
      sets: 5,
      weightTier: "heavy",
    },
  ];

  for (const item of demoItems) {
    const exists = await prisma.workoutExercise.findFirst({
      where: {
        workoutId: demoWorkout.id,
        exerciseId: item.exerciseId,
      },
    });
    if (!exists) {
      await prisma.workoutExercise.create({
        data: { workoutId: demoWorkout.id, ...item },
      });
    } else {
      await prisma.workoutExercise.update({
        where: { id: exists.id },
        data: {
          setScheme: item.setScheme,
          repPattern: item.repPattern,
          reps: item.reps,
          sets: item.sets,
          weightTier: item.weightTier,
          sortOrder: item.sortOrder,
          notes: "notes" in item ? item.notes : undefined,
        },
      });
    }
  }

  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 12);

  if (squat) {
    await prisma.exercisePerformance.deleteMany({
      where: { userId: demoUser.id, exerciseId: squat.id },
    });
    await prisma.exercisePerformance.create({
      data: {
        userId: demoUser.id,
        exerciseId: squat.id,
        setScheme: "positive",
        weightTier: "light",
        startingWeightLbs: 30,
        performedAt: pastDate,
      },
    });
  }

  if (bench) {
    await prisma.exercisePerformance.create({
      data: {
        userId: demoUser.id,
        exerciseId: bench.id,
        setScheme: "drop_sets",
        weightTier: "medium",
        startingWeightLbs: 95,
        performedAt: pastDate,
      },
    });
  }

  // Seed a few historical workout logs so the published demo shows real streak + stats (UX polish)
  await prisma.workoutLog.deleteMany({ where: { userId: demoUser.id } });
  const now = new Date();
  const sampleWorkoutIds = [
    "cmpzkkryb000s95rzdsxn44js", // Day 1
    "cmpzkks91001l95rzheuz6vkw", // Day 2
    "cmpzkkskt002e95rzrk2vgaj3", // Day 4
    "cmpzkksoo002p95rz7407826d", // Day 5
  ];
  // Create 4 logs in last 4 days (gives streak ~4 for demo)
  for (let i = 0; i < sampleWorkoutIds.length; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - (3 - i)); // 3,2,1,0 days ago
    await prisma.workoutLog.create({
      data: {
        userId: demoUser.id,
        workoutId: sampleWorkoutIds[i],
        performedAt: d,
        completed: true,
      },
    });
  }

  // Seed additional demo users for robust user management in admin
  const usersToSeed = [
    { email: "admin@thetrainstation.co", name: "Admin User", role: "ADMIN" as const, status: "active", city: "Austin", state: "TX" },
    { email: "instructor@thetrainstation.co", name: "Coach Kim", role: "INSTRUCTOR" as const, status: "active", city: "Austin", state: "TX" },
    { email: "free@thetrainstation.co", name: "Free Member", role: "MEMBER" as const, status: "active", city: "Austin", state: "TX" },
    { email: "prospective@thetrainstation.co", name: "Jane Doe (Applied)", role: "PROSPECTIVE_INSTRUCTOR" as const, status: "pending", notes: "Applied via site form. Experience: 5yrs personal training. Message: Excited to join!", city: "Dallas", state: "TX" },
  ];

  for (const u of usersToSeed) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, status: u.status, notes: u.notes ?? null },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        status: u.status,
        notes: u.notes ?? null,
      },
    });
  }

  // Give the free/coach member a coach subscription (on-demand only)
  const coachTier = await prisma.subscriptionTier.findUnique({ where: { slug: "coach" } });
  if (coachTier) {
    const freeUser = await prisma.user.findUnique({ where: { email: "free@thetrainstation.co" } });
    if (freeUser) {
      await prisma.user.update({
        where: { id: freeUser.id },
        data: { phone: "(555) 111-2222", dailyReminderTime: "08:00" },
      });
      const existing = await prisma.subscription.findFirst({ where: { userId: freeUser.id } });
      if (!existing) {
        await prisma.subscription.create({
          data: { userId: freeUser.id, tierId: coachTier.id, status: "active" },
        });
      }
    }
  }

  // Seed admin contact info for booking system
  await prisma.adminContact.upsert({
    where: { id: "admin-contact" },
    update: {
      email: "coach@thetrainstation.co",
      phone: "(555) 123-4567",
    },
    create: {
      id: "admin-contact",
      email: "coach@thetrainstation.co",
      phone: "(555) 123-4567",
    },
  });

  // Seed default availability: Mon-Fri 9am-5pm, 15min slots
  const existingAvails = await prisma.adminAvailability.count();
  if (existingAvails === 0) {
    for (let wd = 1; wd <= 5; wd++) { // Mon-Fri
      await prisma.adminAvailability.create({
        data: {
          weekday: wd,
          startHour: 9,
          startMinute: 0,
          endHour: 17,
          endMinute: 0,
          slotDurationMin: 15,
        },
      });
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });