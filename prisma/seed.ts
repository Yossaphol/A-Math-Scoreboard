import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { generateGlobalPlayerId } from "../src/lib/global-player-id";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEV_ADMIN_EMAIL = "yossaphol3502@gmail.com";
const DEV_ADMIN_PASSWORD = "admin1234";
const DEV_STAFF_EMAIL = "staff.dev@example.com";
const DEV_STAFF_PASSWORD = "staff1234";

const SAMPLE_PLAYER_NAMES = [
  "Somchai",
  "Anan",
  "Piyada",
  "Kanya",
  "Wichai",
  "Suda",
  "Anon",
  "Napat",
];

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: DEV_ADMIN_EMAIL },
    update: {},
    create: {
      email: DEV_ADMIN_EMAIL,
      name: "Admin",
      role: "ADMIN",
      passwordHash: await bcrypt.hash(DEV_ADMIN_PASSWORD, 10),
    },
  });

  const staffUser = await prisma.user.upsert({
    where: { email: DEV_STAFF_EMAIL },
    update: {},
    create: {
      email: DEV_STAFF_EMAIL,
      name: "Staff Dev",
      role: "STAFF",
      passwordHash: await bcrypt.hash(DEV_STAFF_PASSWORD, 10),
    },
  });

  const tournament = await prisma.tournament.upsert({
    where: { id: "seed-tournament-a" },
    update: {},
    create: {
      id: "seed-tournament-a",
      name: "Sample Open Tournament",
      mode: "COMPETITION",
      status: "ONGOING",
      setPlayerLimit: true,
      maxPlayers: 24,
      setNumberOfGames: true,
      numberOfGames: 6,
      useFirstSecond: true,
      defaultMaximumScore: 350,
      createdById: admin.id,
    },
  });

  await prisma.tournamentStaff.upsert({
    where: { userId_tournamentId: { userId: staffUser.id, tournamentId: tournament.id } },
    update: {},
    create: {
      userId: staffUser.id,
      tournamentId: tournament.id,
      status: "ACTIVE",
    },
  });

  for (let i = 0; i < SAMPLE_PLAYER_NAMES.length; i++) {
    const name = SAMPLE_PLAYER_NAMES[i];
    const globalPlayer = await prisma.globalPlayer.create({
      data: { id: await generateGlobalPlayerId(prisma), name },
    });

    await prisma.tournamentPlayer.create({
      data: {
        tournamentId: tournament.id,
        globalPlayerId: globalPlayer.id,
        tournamentPlayerNo: i + 1,
        status: "ACTIVE",
      },
    });
  }

  for (let tableNumber = 1; tableNumber <= 4; tableNumber++) {
    await prisma.tournamentTable.upsert({
      where: { tournamentId_tableNumber: { tournamentId: tournament.id, tableNumber } },
      update: {},
      create: {
        tournamentId: tournament.id,
        tableNumber,
      },
    });
  }

  console.log("Seed complete.");
  console.log(`Admin login:  ${DEV_ADMIN_EMAIL} / ${DEV_ADMIN_PASSWORD}`);
  console.log(`Staff login:  ${DEV_STAFF_EMAIL} / ${DEV_STAFF_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
