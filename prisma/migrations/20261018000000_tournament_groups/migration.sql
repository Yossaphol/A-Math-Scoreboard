-- Pairing groups (ชาย / หญิง, ...): a Round can pair within each group instead of across everyone.
-- Additive only — new tables, a nullable TournamentPlayer.groupId and Round.splitByGroup
-- defaulting to false, so every existing Round and player behaves exactly as before.

-- AlterTable
ALTER TABLE "Round" ADD COLUMN     "splitByGroup" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TournamentPlayer" ADD COLUMN     "groupId" TEXT;

-- CreateTable
CREATE TABLE "TournamentGroup" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoundGroupMethod" (
    "roundId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "pairingMethod" "PairingMethod" NOT NULL,

    CONSTRAINT "RoundGroupMethod_pkey" PRIMARY KEY ("roundId","groupId")
);

-- CreateIndex
CREATE UNIQUE INDEX "TournamentGroup_tournamentId_name_key" ON "TournamentGroup"("tournamentId", "name");

-- AddForeignKey
ALTER TABLE "TournamentPlayer" ADD CONSTRAINT "TournamentPlayer_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TournamentGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentGroup" ADD CONSTRAINT "TournamentGroup_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundGroupMethod" ADD CONSTRAINT "RoundGroupMethod_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundGroupMethod" ADD CONSTRAINT "RoundGroupMethod_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TournamentGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
