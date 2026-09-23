-- Absent players: a player who was paired for a Round but never showed up is recorded here
-- (forfeit: L 0-100, Diff -100) and taken out of the Round's matches, so the players left
-- without an opponent can be re-paired among themselves instead of each getting a Bye.
-- A player at the table can report "my opponent didn't show" (Match.byeClaimedById/At),
-- pending Admin/Staff approval. All new Match columns are nullable; existing rows unaffected.

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "byeClaimedAt" TIMESTAMP(3),
ADD COLUMN     "byeClaimedById" TEXT;

-- CreateTable
CREATE TABLE "RoundAbsence" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "tournamentPlayerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoundAbsence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoundAbsence_tournamentId_idx" ON "RoundAbsence"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "RoundAbsence_roundId_tournamentPlayerId_key" ON "RoundAbsence"("roundId", "tournamentPlayerId");

-- AddForeignKey
ALTER TABLE "RoundAbsence" ADD CONSTRAINT "RoundAbsence_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundAbsence" ADD CONSTRAINT "RoundAbsence_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundAbsence" ADD CONSTRAINT "RoundAbsence_tournamentPlayerId_fkey" FOREIGN KEY ("tournamentPlayerId") REFERENCES "TournamentPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
