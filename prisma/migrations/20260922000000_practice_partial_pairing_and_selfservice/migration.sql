-- Practice mode: self-service ad-hoc scoring needs a Match that isn't tied to any Round, plus
-- a tournament-wide link/QR token to reach it. See src/lib/actions/self-service.ts.

-- 1. Tournament: new optional unique token for the self-service link/QR.
ALTER TABLE "Tournament" ADD COLUMN "selfServiceToken" TEXT;
CREATE UNIQUE INDEX "Tournament_selfServiceToken_key" ON "Tournament"("selfServiceToken");

-- 2. Match: add tournamentId as NULLABLE first so it can be backfilled.
ALTER TABLE "Match" ADD COLUMN "tournamentId" TEXT;

-- 3. Backfill from the existing (currently required) roundId -> Round.tournamentId. Every
--    existing Match row has a roundId today, so this covers 100% of current rows.
UPDATE "Match" m
SET "tournamentId" = r."tournamentId"
FROM "Round" r
WHERE m."roundId" = r.id;

-- 4. Now safe to make it required, add its FK and index.
ALTER TABLE "Match" ALTER COLUMN "tournamentId" SET NOT NULL;
ALTER TABLE "Match" ADD CONSTRAINT "Match_tournamentId_fkey"
  FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Match_tournamentId_idx" ON "Match"("tournamentId");

-- 5. Relax roundId to optional — self-service ad-hoc matches have no Round at all.
ALTER TABLE "Match" ALTER COLUMN "roundId" DROP NOT NULL;

-- 6. Maximum Score snapshot, only ever populated for ad-hoc matches (roundId null) — round-based
--    matches keep reading from Round.maximumScoreEnabled/maximumScore, unchanged.
ALTER TABLE "Match" ADD COLUMN "maximumScoreEnabled" BOOLEAN;
ALTER TABLE "Match" ADD COLUMN "maximumScore" INTEGER;
