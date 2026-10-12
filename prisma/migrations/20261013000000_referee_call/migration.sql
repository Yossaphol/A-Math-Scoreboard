-- "Call a referee" from a table QR page, streamed to Admin/Staff screens. New table only;
-- existing rows unaffected.

-- CreateEnum
CREATE TYPE "RefereeCallStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'CANCELLED');

-- CreateTable
CREATE TABLE "RefereeCall" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "matchId" TEXT,
    "status" "RefereeCallStatus" NOT NULL DEFAULT 'OPEN',
    "handledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "RefereeCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RefereeCall_status_tournamentId_idx" ON "RefereeCall"("status", "tournamentId");

-- CreateIndex
CREATE INDEX "RefereeCall_tableId_status_idx" ON "RefereeCall"("tableId", "status");

-- AddForeignKey
ALTER TABLE "RefereeCall" ADD CONSTRAINT "RefereeCall_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefereeCall" ADD CONSTRAINT "RefereeCall_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "TournamentTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefereeCall" ADD CONSTRAINT "RefereeCall_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefereeCall" ADD CONSTRAINT "RefereeCall_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

