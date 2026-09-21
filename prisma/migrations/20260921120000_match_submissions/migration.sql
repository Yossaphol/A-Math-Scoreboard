-- CreateEnum
CREATE TYPE "MatchSide" AS ENUM ('PLAYER1', 'PLAYER2');

-- AlterTable
ALTER TABLE "Match" DROP COLUMN "player1SubmittedScore",
DROP COLUMN "player2SubmittedScore",
DROP COLUMN "player1ConfirmedAt",
DROP COLUMN "player2ConfirmedAt";

-- CreateTable
CREATE TABLE "MatchSubmission" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "side" "MatchSide" NOT NULL,
    "player1Score" INTEGER NOT NULL,
    "player2Score" INTEGER NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchSubmission_matchId_side_key" ON "MatchSubmission"("matchId", "side");

-- AddForeignKey
ALTER TABLE "MatchSubmission" ADD CONSTRAINT "MatchSubmission_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
