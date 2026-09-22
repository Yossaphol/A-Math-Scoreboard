// One-off, read-only: find every ACTIVE TournamentStaff assignment whose User is stuck on
// role=USER (the assignStaff bug in src/lib/actions/staff.ts before the fix) — these accounts
// have an active staff assignment but can't reach /admin until re-added (or fixed directly).
// Usage:
//   DATABASE_URL="<prod connection string>" npx tsx prisma/check-broken-staff.ts
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const broken = await prisma.tournamentStaff.findMany({
    where: { status: "ACTIVE", user: { role: "USER" } },
    include: { user: true, tournament: true },
  });

  if (broken.length === 0) {
    console.log("None found — every ACTIVE staff assignment already has role=STAFF or ADMIN.");
    return;
  }

  console.log(`Found ${broken.length} broken staff assignment(s):`);
  for (const a of broken) {
    console.log(`- ${a.user.email} → "${a.tournament.name}" (role currently: ${a.user.role})`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
