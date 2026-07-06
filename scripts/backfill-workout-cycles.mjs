#!/usr/bin/env node
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createPgPool } from "../src/lib/pg-connection.ts";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.go-prod", override: true });

async function main() {
  const { backfillProgramCycles, listWorkoutCycles } = await import("../src/lib/workout-cycle-db.ts");
  const pool = createPgPool(process.env.DATABASE_URL);
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const slug = process.argv[2] || "adult";
  const program = await prisma.program.findUnique({ where: { slug }, select: { id: true, name: true } });
  if (!program) {
    console.error(`Program not found: ${slug}`);
    process.exit(1);
  }

  const created = await backfillProgramCycles(program.id);
  const cycles = await listWorkoutCycles({ programSlug: slug });
  console.log(`Backfill ${program.name}: created ${created.length} cycle(s)`);
  for (const c of cycles.filter((x) => x.programId)) {
    const filled = c.days.filter((d) => d.slots.length > 0 || d.isDayOff).length;
    console.log(`  · ${c.name} M${c.cycleMonth} — ${filled}/28 days with content`);
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});