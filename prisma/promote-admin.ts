// One-off bootstrap: promote (or create) a user as ADMIN by email.
// Needed because the Admins page (src/app/admin/(protected)/admins/page.tsx) can only
// be used by an existing admin — this is how you create the first one against a database
// that has none yet (e.g. production, which prisma/seed.ts never touches).
//
// Usage:
//   DATABASE_URL="<prod connection string>" npx tsx prisma/promote-admin.ts <email>
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const email = process.argv[2];
if (!email) {
  console.error("Usage: tsx prisma/promote-admin.ts <email>");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const user = await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN" },
    create: { email, role: "ADMIN" },
  });
  console.log(`OK: ${user.email} is now role=${user.role} (id ${user.id})`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
