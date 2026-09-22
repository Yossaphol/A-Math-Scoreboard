// One-off: report current database size against the Prisma Postgres Free tier limit (500 MB).
// Usage:
//   DATABASE_URL="<prod connection string>" npx tsx prisma/check-db-usage.ts
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const FREE_TIER_BYTES = 500 * 1024 * 1024;

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function formatBytes(bytes: number) {
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

async function main() {
  const rows = await prisma.$queryRaw<{ bytes: bigint }[]>`
    SELECT pg_database_size(current_database()) AS bytes
  `;
  const bytes = Number(rows[0].bytes);
  const pct = (bytes / FREE_TIER_BYTES) * 100;
  console.log(`Used: ${formatBytes(bytes)} / ${formatBytes(FREE_TIER_BYTES)} (${pct.toFixed(1)}%)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
