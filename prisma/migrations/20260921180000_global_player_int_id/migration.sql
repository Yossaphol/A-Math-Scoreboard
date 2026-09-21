-- GlobalPlayer.id switches from a cuid (text) to a plain sequential integer, so it reads
-- as the human-facing ID it is. This is destructive by design: pre-launch, with only seed
-- data in play, so dependent tables are recreated rather than cast in place.

-- DropForeignKey
ALTER TABLE "LinkRequest" DROP CONSTRAINT "LinkRequest_globalPlayerId_fkey";

-- DropForeignKey
ALTER TABLE "TournamentPlayer" DROP CONSTRAINT "TournamentPlayer_globalPlayerId_fkey";

-- AlterTable: GlobalPlayer.id becomes a serial integer
ALTER TABLE "GlobalPlayer" DROP CONSTRAINT "GlobalPlayer_pkey";
ALTER TABLE "GlobalPlayer" DROP COLUMN "id";
ALTER TABLE "GlobalPlayer" ADD COLUMN "id" SERIAL NOT NULL;
ALTER TABLE "GlobalPlayer" ADD CONSTRAINT "GlobalPlayer_pkey" PRIMARY KEY ("id");

-- AlterTable: dependent foreign key columns follow the new integer type
ALTER TABLE "LinkRequest" DROP COLUMN "globalPlayerId";
ALTER TABLE "LinkRequest" ADD COLUMN "globalPlayerId" INTEGER NOT NULL;

ALTER TABLE "TournamentPlayer" DROP COLUMN "globalPlayerId";
ALTER TABLE "TournamentPlayer" ADD COLUMN "globalPlayerId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "LinkRequest" ADD CONSTRAINT "LinkRequest_globalPlayerId_fkey" FOREIGN KEY ("globalPlayerId") REFERENCES "GlobalPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentPlayer" ADD CONSTRAINT "TournamentPlayer_globalPlayerId_fkey" FOREIGN KEY ("globalPlayerId") REFERENCES "GlobalPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RecreateIndex
CREATE UNIQUE INDEX "TournamentPlayer_tournamentId_globalPlayerId_key" ON "TournamentPlayer"("tournamentId", "globalPlayerId");
